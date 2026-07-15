"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, logModAction } from "@/lib/db";
import { dmUser, slackHandle } from "@/lib/slack";
import { requirePerm, requireSuper, ALL_PERMISSIONS, type AdminAccess } from "@/lib/guard";

const DEFAULT_WARNING =
  "Please keep chat messages and display names appropriate. Continued violations may result in a ban from Pixl.";

function actorName(access: AdminAccess): string {
  return `${access.session.name} (${access.session.slackId})`;
}

export async function warnPlayer(formData: FormData): Promise<void> {
  const access = await requirePerm("warn");
  const by = actorName(access);
  const userId = String(formData.get("userId") ?? "");
  const message = String(formData.get("message") ?? "").trim() || DEFAULT_WARNING;
  if (!userId) return;

  const { error } = await db.from("notifications").insert({
    user_id: userId,
    title: "Moderation warning",
    body: message,
  });
  if (error) console.error("warn notification failed", error.message);

  const { data } = await db
    .from("users")
    .select("slack_id, display_name")
    .eq("id", userId)
    .single();
  if (data?.slack_id) {
    const dm = [
      "You've received a moderation warning from Pixl.",
      message,
      "If you believe this is a mistake, reach out to the Pixl team.",
    ].join("\n\n");
    try {
      await dmUser(data.slack_id, dm);
    } catch (e) {
      console.error("warn DM failed", e);
    }
  }
  await logModAction(userId, "warn", message, by);
  revalidatePath("/", "layout");
}

function readSeconds(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "0"));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 86400);
}

async function claimedHoursFor(projectId: number): Promise<number> {
  const [{ data: journals }, { data: proj }] = await Promise.all([
    db.from("project_journals").select("hours").eq("project_id", projectId),
    db.from("projects").select("hackatime_seconds").eq("id", projectId).single(),
  ]);
  const journalHours =
    Math.round((journals ?? []).reduce((s, j) => s + (Number(j.hours) || 0), 0) * 10) / 10;
  const hackatimeHours =
    Math.round(((Number(proj?.hackatime_seconds) || 0) / 3600) * 10) / 10;
  return hackatimeHours > 0 ? hackatimeHours : journalHours;
}

export async function reviewProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  const verdict = String(formData.get("verdict") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!projectId || (verdict !== "approved" && verdict !== "needs_changes")) return;
  if (!note)
    redirect(`/review?error=${encodeURIComponent("Feedback is required for every verdict.")}`);

  const claimedHours = await claimedHoursFor(projectId);

  const hoursRaw = String(formData.get("approvedHours") ?? "").trim();
  let approvedHours: number | null = null;
  if (hoursRaw !== "") {
    const n = Number(hoursRaw);
    if (!Number.isFinite(n) || n < 0)
      redirect(`/review?error=${encodeURIComponent("Credited hours must be a number of 0 or more.")}`);
    approvedHours = Math.min(Math.round(n * 10) / 10, claimedHours);
  }

  const approved = verdict === "approved";
  const update: Record<string, unknown> = {
    status: verdict,
    review_note: note,
    reviewing_by: "",
    reviewing_at: null,
  };
  if (approved) update.approved_hours = approvedHours;
  const { data: project, error } = await db
    .from("projects")
    .update(update)
    .eq("id", projectId)
    .eq("status", "shipped")
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("reviewProject failed", error?.message);
    return;
  }

  const { error: auditError } = await db.from("review_audits").insert({
    project_id: projectId,
    user_id: project.user_id,
    reviewer: by,
    verdict,
    note,
    claimed_hours: claimedHours,
    approved_hours: approvedHours,
    repo_opened: formData.get("repoOpened") === "1",
    demo_opened: formData.get("demoOpened") === "1",
    repo_seconds: readSeconds(formData.get("repoSeconds")),
    demo_seconds: readSeconds(formData.get("demoSeconds")),
    total_seconds: readSeconds(formData.get("totalSeconds")),
  });
  if (auditError) console.error("review audit insert failed", auditError.message);

  const reviewer = (await slackHandle(access.session.slackId)) ?? access.session.name;
  const title = approved ? "Project approved!" : "Project needs changes";
  const credited =
    approved && approvedHours !== null && approvedHours !== claimedHours
      ? `\n\nHours credited: ${approvedHours}h (you logged ${claimedHours}h).`
      : "";
  const body = approved
    ? `"${project.name}" passed review — approved by ${reviewer}. Congrats on shipping!\n\nReviewer note: ${note}${credited}`
    : `"${project.name}" was sent back by ${reviewer}:\n\n${note}\n\nUpdate your project and ship it again.`;
  const { error: notifyError } = await db
    .from("notifications")
    .insert({ user_id: project.user_id, title, body });
  if (notifyError) console.error("review notification failed", notifyError.message);

  const { data: owner } = await db
    .from("users")
    .select("slack_id")
    .eq("id", project.user_id)
    .single();
  if (owner?.slack_id) {
    try {
      await dmUser(owner.slack_id, `${title}\n\n${body}`);
    } catch (e) {
      console.error("review DM failed", e);
    }
  }
  await logModAction(
    project.user_id,
    approved ? "project_approved" : "project_needs_changes",
    `${project.name}${note ? `: ${note}` : ""}`,
    by,
  );
  revalidatePath("/review");
}

export async function reReviewProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  if (!projectId) return;

  const { data: project, error } = await db
    .from("projects")
    .update({ status: "shipped", review_note: "", approved_hours: null })
    .eq("id", projectId)
    .in("status", ["approved", "needs_changes"])
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("reReviewProject failed", error?.message);
    return;
  }

  const claimedHours = await claimedHoursFor(projectId);

  await logModAction(
    project.user_id,
    "review_reverted",
    `${project.name}: verdict reverted, back in the review queue`,
    by,
  );
  const { error: auditError } = await db.from("review_audits").insert({
    project_id: projectId,
    user_id: project.user_id,
    reviewer: by,
    verdict: "reverted",
    note: "Previous verdict reverted — project returned to the review queue.",
    claimed_hours: claimedHours,
  });
  if (auditError) console.error("re-review audit insert failed", auditError.message);

  const { error: notifyError } = await db.from("notifications").insert({
    user_id: project.user_id,
    title: "Project back in review",
    body: `"${project.name}" is getting another look from the review team. You'll hear back here soon — nothing needed from you.`,
  });
  if (notifyError) console.error("re-review notification failed", notifyError.message);
  revalidatePath("/", "layout");
}

export async function archiveProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  const unarchive = formData.get("unarchive") === "1";
  if (!projectId) return;
  const { data: project, error } = await db
    .from("projects")
    .update({ archived_at: unarchive ? null : new Date().toISOString() })
    .eq("id", projectId)
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("archiveProject failed", error?.message);
    return;
  }
  await logModAction(
    project.user_id,
    unarchive ? "project_unarchived" : "project_archived",
    project.name,
    by,
  );
  revalidatePath("/", "layout");
}

export async function rejectProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const returnTo = String(formData.get("returnTo") ?? "") || `/projects/${projectId}`;
  if (!projectId) return;
  if (!reason)
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("A reason is required to reject a project.")}`);

  const reviewer = (await slackHandle(access.session.slackId)) ?? access.session.name;

  const { data: project, error } = await db
    .from("projects")
    .update({
      rejected_at: new Date().toISOString(),
      reject_reason: reason,
      reject_by: reviewer,
    })
    .eq("id", projectId)
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("rejectProject failed", error?.message);
    return;
  }
  await logModAction(project.user_id, "project_rejected", `${project.name}: ${reason}`, by);

  const body = `Your project "${project.name}" was rejected by ${reviewer} and removed from Pixl.\n\nReason: ${reason}\n\nIf you think this is a mistake, contact the Pixl team.`;
  const { error: notifyError } = await db.from("notifications").insert({
    user_id: project.user_id,
    title: "Project rejected",
    body,
  });
  if (notifyError) console.error("reject notification failed", notifyError.message);

  const { data: owner } = await db
    .from("users")
    .select("slack_id")
    .eq("id", project.user_id)
    .single();
  if (owner?.slack_id) {
    try {
      await dmUser(owner.slack_id, body);
    } catch (e) {
      console.error("reject DM failed", e);
    }
  }
  revalidatePath("/", "layout");
}

export async function unrejectProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  if (!projectId) return;
  const { data: project, error } = await db
    .from("projects")
    .update({ rejected_at: null, reject_reason: "", reject_by: "" })
    .eq("id", projectId)
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("unrejectProject failed", error?.message);
    return;
  }
  await logModAction(project.user_id, "project_unrejected", project.name, by);
  const { error: notifyError } = await db.from("notifications").insert({
    user_id: project.user_id,
    title: "Project restored",
    body: `"${project.name}" was restored and is visible again. Sorry for the mix-up!`,
  });
  if (notifyError) console.error("unreject notification failed", notifyError.message);
  revalidatePath("/", "layout");
}

export async function banProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const returnTo = String(formData.get("returnTo") ?? "") || `/projects/${projectId}`;
  if (!projectId) return;
  if (!reason)
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("A reason is required to ban a project.")}`);

  const reviewer = (await slackHandle(access.session.slackId)) ?? access.session.name;

  const { data: project, error } = await db
    .from("projects")
    .update({
      banned_at: new Date().toISOString(),
      ban_reason: reason,
      ban_by: reviewer,
    })
    .eq("id", projectId)
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("banProject failed", error?.message);
    return;
  }
  await logModAction(project.user_id, "project_banned", `${project.name}: ${reason}`, by);

  const body = `Your project "${project.name}" was permanently banned by ${reviewer} and can no longer be shipped to Pixl.\n\nReason: ${reason}\n\nIf you think this is a mistake, contact the Pixl team.`;
  const { error: notifyError } = await db.from("notifications").insert({
    user_id: project.user_id,
    title: "Project banned",
    body,
  });
  if (notifyError) console.error("ban notification failed", notifyError.message);

  const { data: owner } = await db
    .from("users")
    .select("slack_id")
    .eq("id", project.user_id)
    .single();
  if (owner?.slack_id) {
    try {
      await dmUser(owner.slack_id, body);
    } catch (e) {
      console.error("ban DM failed", e);
    }
  }
  revalidatePath("/", "layout");
}

export async function unbanProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  if (!projectId) return;
  const { data: project, error } = await db
    .from("projects")
    .update({ banned_at: null, ban_reason: "", ban_by: "" })
    .eq("id", projectId)
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("unbanProject failed", error?.message);
    return;
  }
  await logModAction(project.user_id, "project_unbanned", project.name, by);
  const { error: notifyError } = await db.from("notifications").insert({
    user_id: project.user_id,
    title: "Project ban lifted",
    body: `The ban on "${project.name}" was lifted. You can ship it again. Sorry for the mix-up!`,
  });
  if (notifyError) console.error("unban notification failed", notifyError.message);
  revalidatePath("/", "layout");
}

export async function banPlayer(formData: FormData): Promise<void> {
  const access = await requirePerm("ban");
  const by = actorName(access);
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const hours = Number(formData.get("hours") ?? 0);
  if (!userId) return;

  const expiresAt =
    hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
  const { error } = await db.from("bans").insert({
    user_id: userId,
    reason,
    banned_by: by,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  await logModAction(
    userId,
    "ban",
    expiresAt ? `${hours}h — ${reason}` : `permanent — ${reason}`,
    by,
  );

  const { data } = await db
    .from("users")
    .select("slack_id")
    .eq("id", userId)
    .single();
  if (data?.slack_id) {
    const lines = [
      expiresAt
        ? `You've been temporarily banned from Pixl until ${new Date(expiresAt).toUTCString()}.`
        : "You've been permanently banned from Pixl.",
    ];
    if (reason) lines.push(`Reason: ${reason}`);
    lines.push("If you believe this is a mistake, reach out to the Pixl team.");
    try {
      await dmUser(data.slack_id, lines.join("\n\n"));
    } catch (e) {
      console.error("ban DM failed", e);
    }
  }
  revalidatePath("/", "layout");
}

export async function liftBan(formData: FormData): Promise<void> {
  const access = await requirePerm("ban");
  const by = actorName(access);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const now = new Date().toISOString();
  const { data: lifted, error } = await db
    .from("bans")
    .update({ lifted_at: now })
    .eq("user_id", userId)
    .is("lifted_at", null)
    .select("id");
  if (error) throw new Error(error.message);

  const count = (lifted ?? []).length;
  await logModAction(userId, "unban", `${count} active ban(s) lifted`, by);

  if (count > 0) {
    const { data } = await db
      .from("users")
      .select("slack_id")
      .eq("id", userId)
      .single();
    if (data?.slack_id) {
      const dm = [
        "Your ban from Pixl has been lifted. You're welcome to rejoin the game.",
        "Please keep the community guidelines in mind going forward.",
      ].join("\n\n");
      try {
        await dmUser(data.slack_id, dm);
      } catch (e) {
        console.error("unban DM failed", e);
      }
    }
  }
  revalidatePath("/", "layout");
}

export async function sendNotification(formData: FormData): Promise<void> {
  const access = await requirePerm("notify");
  const by = actorName(access);
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const body = String(formData.get("body") ?? "").trim().slice(0, 500);
  const userId = String(formData.get("userId") ?? "").trim();
  const playerName = String(formData.get("playerName") ?? "").trim();
  const backTo = String(formData.get("backTo") ?? "");
  if (!title || !body) {
    if (backTo) redirect(`${backTo}?error=${encodeURIComponent("Title and message are required.")}`);
    return;
  }

  let targetId = userId;
  if (!targetId && playerName) {
    const { data } = await db
      .from("users")
      .select("id, display_name")
      .ilike("display_name", playerName)
      .limit(2);
    if (!data || data.length !== 1) {
      if (backTo)
        redirect(
          `${backTo}?error=${encodeURIComponent(
            data && data.length > 1
              ? `Multiple players match "${playerName}" — be more specific.`
              : `No player named "${playerName}".`,
          )}`,
        );
      return;
    }
    targetId = data[0].id as string;
  }

  if (targetId) {
    const { error } = await db
      .from("notifications")
      .insert({ user_id: targetId, title, body });
    if (error) throw new Error(error.message);
    await logModAction(targetId, "notify", title, by);
    revalidatePath("/", "layout");
    if (backTo) redirect(`${backTo}?sent=1`);
    return;
  }

  const { data: users, error } = await db.from("users").select("id");
  if (error) throw new Error(error.message);
  const rows = (users ?? []).map((u) => ({ user_id: u.id as string, title, body }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insertError } = await db
      .from("notifications")
      .insert(rows.slice(i, i + 500));
    if (insertError) throw new Error(insertError.message);
  }
  revalidatePath("/", "layout");
  if (backTo) redirect(`${backTo}?sent=${rows.length}`);
}

export async function addAdmin(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const perms = formData
    .getAll("perms")
    .map(String)
    .filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));
  if (!slackId) return;
  const { error } = await db.from("admins").upsert({
    slack_id: slackId,
    name: name || slackId,
    permissions: perms,
    added_by: actorName(access),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admins");
}

export async function updateAdminPerms(formData: FormData): Promise<void> {
  await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  const perms = formData
    .getAll("perms")
    .map(String)
    .filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));
  if (!slackId) return;
  const { error } = await db
    .from("admins")
    .update({ permissions: perms })
    .eq("slack_id", slackId);
  if (error) throw new Error(error.message);
  revalidatePath("/admins");
}

export async function removeAdmin(formData: FormData): Promise<void> {
  await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  if (!slackId) return;
  const { error } = await db.from("admins").delete().eq("slack_id", slackId);
  if (error) throw new Error(error.message);
  revalidatePath("/admins");
}
