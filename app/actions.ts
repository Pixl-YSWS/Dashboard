"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  db,
  getAdmin,
  logModAction,
  creditProjectPixels,
  revokeProjectPixels,
  projectPixelTotal,
} from "@/lib/db";
import { slackHandle } from "@/lib/slack";
import { dmOrEmail } from "@/lib/notify";
import {
  requirePerm,
  requireSuper,
  ownerSlackIds,
  secondPassSlackIds,
  SUBADMIN_PERMISSIONS,
  NO_REVIEW,
  type AdminAccess,
} from "@/lib/guard";

const DEFAULT_WARNING =
  "Please keep chat messages and display names appropriate. Continued violations may result in a ban from Pixl.";

function actorName(access: AdminAccess): string {
  return `${access.session.name} (${access.session.slackId})`;
}

// 1 hour = 5 pixels, whole pixels only. 10 pixels = $1.
const PIXELS_PER_HOUR = 5;

// A reviewer may never act on their own submission (self-review = cheating).
async function isOwnProject(access: AdminAccess, userId: string): Promise<boolean> {
  const { data } = await db.from("users").select("slack_id").eq("id", userId).single();
  return !!data?.slack_id && data.slack_id === access.session.slackId;
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

  await dmOrEmail(
    userId,
    "Moderation warning",
    [
      "You've received a moderation warning from Pixl.",
      message,
      "If you believe this is a mistake, reach out to the Pixl team.",
    ].join("\n\n"),
  );
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

async function insertReviewAudit(
  formData: FormData,
  projectId: number,
  userId: string,
  reviewer: string,
  verdict: string,
  note: string,
  claimedHours: number,
  approvedHours: number | null,
): Promise<void> {
  const { error } = await db.from("review_audits").insert({
    project_id: projectId,
    user_id: userId,
    reviewer,
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
  if (error) console.error("review audit insert failed", error.message);
}

async function notifyOwner(
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  const { error } = await db.from("notifications").insert({ user_id: userId, title, body });
  if (error) console.error("review notification failed", error.message);
  await dmOrEmail(userId, title, body);
}

// Two-pass review. A shipped project gets a first pass from any reviewer; if
// approved it moves to 'second_review' for a final reviewer's sign-off (unless
// that first reviewer is themselves a final reviewer, in which case it's
// approved outright). Pixels are credited only on final approval. "Request
// changes" bounces it back to the maker from either stage.
export async function reviewProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  const verdict = String(formData.get("verdict") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!projectId || (verdict !== "approved" && verdict !== "needs_changes")) return;

  const { data: current } = await db
    .from("projects")
    .select("status, user_id, name, first_pass_by")
    .eq("id", projectId)
    .single();
  if (!current) return;
  const stage = String(current.status);
  const back = `/review/${projectId}`;
  if (stage === "shipped" && (await isOwnProject(access, current.user_id)))
    redirect(`${back}?error=${encodeURIComponent("You can't first-pass your own project — another reviewer has to take it.")}`);
  if (stage !== "shipped" && stage !== "second_review")
    redirect(`${back}?error=${encodeURIComponent("This project isn't awaiting review anymore.")}`);
  if (!note)
    redirect(`${back}?error=${encodeURIComponent("Feedback is required for every verdict.")}`);

  const claimedHours = await claimedHoursFor(projectId);
  const hoursRaw = String(formData.get("approvedHours") ?? "").trim();
  let approvedHours: number | null = null;
  if (hoursRaw !== "") {
    const n = Number(hoursRaw);
    if (!Number.isFinite(n) || n < 0)
      redirect(`${back}?error=${encodeURIComponent("Credited hours must be a number of 0 or more.")}`);
    approvedHours = Math.min(Math.round(n * 10) / 10, claimedHours);
  }
  const reviewer = (await slackHandle(access.session.slackId)) ?? access.session.name;

  // Request changes — bounce back to the maker from either stage.
  if (verdict === "needs_changes") {
    const { data: project, error } = await db
      .from("projects")
      .update({
        status: "needs_changes",
        review_note: note,
        reviewing_by: "",
        reviewing_at: null,
        first_pass_by: "",
        first_pass_at: null,
        first_pass_note: "",
        first_pass_hours: null,
      })
      .eq("id", projectId)
      .in("status", ["shipped", "second_review"])
      .select("id, name, user_id")
      .single();
    if (error || !project) {
      console.error("reviewProject (changes) failed", error?.message);
      return;
    }
    await insertReviewAudit(formData, projectId, project.user_id, by, "needs_changes", note, claimedHours, approvedHours);
    await notifyOwner(
      project.user_id,
      "Changes requested",
      `"${project.name}" needs changes before it can be approved — ${reviewer}:\n\n${note}\n\nUpdate your project and ship it again.`,
    );
    await logModAction(project.user_id, "project_needs_changes", `${project.name}: ${note}`, by);
    revalidatePath("/review");
    redirect("/review");
  }

  // First pass without final-reviewer rights → hold for a second pass.
  if (stage === "shipped" && !access.canSecondPass) {
    const { data: project, error } = await db
      .from("projects")
      .update({
        status: "second_review",
        review_note: note,
        approved_hours: approvedHours,
        reviewing_by: "",
        reviewing_at: null,
        first_pass_by: by,
        first_pass_at: new Date().toISOString(),
        first_pass_note: note,
        first_pass_hours: approvedHours,
      })
      .eq("id", projectId)
      .eq("status", "shipped")
      .select("id, name, user_id")
      .single();
    if (error || !project) {
      console.error("reviewProject (first pass) failed", error?.message);
      return;
    }
    await insertReviewAudit(formData, projectId, project.user_id, by, "first_pass_approved", note, claimedHours, approvedHours);
    await logModAction(project.user_id, "project_first_pass", `${project.name}: ${note}`, by);
    revalidatePath("/review");
    redirect("/review");
  }

  // Final approval — credit pixels. Only final reviewers reach here.
  if (stage === "second_review" && !access.canSecondPass)
    redirect(`${back}?error=${encodeURIComponent("Only a final reviewer can approve this stage.")}`);
  if (stage === "second_review" && current.first_pass_by && current.first_pass_by === by)
    redirect(`${back}?error=${encodeURIComponent("A different reviewer must do the final pass.")}`);

  const creditHours = approvedHours ?? claimedHours;
  const { data: project, error } = await db
    .from("projects")
    .update({
      status: "approved",
      review_note: note,
      approved_hours: approvedHours,
      reviewing_by: "",
      reviewing_at: null,
    })
    .eq("id", projectId)
    .in("status", ["shipped", "second_review"])
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("reviewProject (approve) failed", error?.message);
    return;
  }
  await insertReviewAudit(formData, projectId, project.user_id, by, "approved", note, claimedHours, approvedHours);

  // Lifetime credit for the project = round(hours * 5); the DB function only
  // adds the delta vs what earlier approvals already paid out.
  const totalPx = Math.round(creditHours * PIXELS_PER_HOUR);
  const alreadyPx = await projectPixelTotal(project.id);
  const deltaPx = totalPx - alreadyPx;
  await creditProjectPixels(project.user_id, project.id, totalPx, creditHours, by);

  let credited: string;
  if (alreadyPx > 0 && deltaPx > 0) {
    credited = `\n\n+${deltaPx} pixels for what's new (${totalPx} pixels total for this project — ${creditHours}h approved).`;
  } else if (alreadyPx > 0 && deltaPx <= 0) {
    credited = `\n\nNo new pixels this time — this project already earned ${alreadyPx} pixels.`;
  } else {
    credited =
      approvedHours !== null && approvedHours !== claimedHours
        ? `\n\n${totalPx} pixels credited (${approvedHours}h approved of ${claimedHours}h logged).`
        : `\n\n${totalPx} pixels credited for ${creditHours}h approved.`;
  }
  await notifyOwner(
    project.user_id,
    "Project approved!",
    `"${project.name}" passed review — approved by ${reviewer}. Congrats on shipping!\n\nReviewer note: ${note}${credited}`,
  );
  await logModAction(
    project.user_id,
    "project_approved",
    `${project.name}: ${deltaPx >= 0 ? "+" : ""}${deltaPx} pixels (total ${totalPx})`,
    by,
  );
  revalidatePath("/review");
  redirect("/review");
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

  // The verdict is void, so the payout is too — claw back every pixel this
  // project was credited and leave the reversal in the ledger.
  const revoked = await revokeProjectPixels(project.user_id, project.id, by);

  await logModAction(
    project.user_id,
    "review_reverted",
    `${project.name}: verdict reverted, back in the review queue${
      revoked > 0 ? ` — ${revoked} pixels revoked` : ""
    }`,
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
    body: `"${project.name}" is getting another look from the review team.${
      revoked > 0
        ? ` The ${revoked} pixels it earned are on hold until the new verdict.`
        : ""
    } You'll hear back here soon — nothing needed from you.`,
  });
  if (notifyError) console.error("re-review notification failed", notifyError.message);
  revalidatePath("/", "layout");
}

// Manual pixel correction from the Pixels tab. Deducts (or grants) whole
// pixels with a mandatory reason; owners only, everything lands in the ledger.
export async function adjustPixels(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const by = actorName(access);
  const userId = String(formData.get("userId") ?? "").trim();
  const amount = Math.round(Number(formData.get("amount") ?? 0));
  const deduct = formData.get("mode") !== "grant";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!userId || !Number.isFinite(amount) || amount <= 0)
    redirect(`/pixels?error=${encodeURIComponent("Pick a player and a whole number of pixels.")}`);
  if (!reason)
    redirect(`/pixels?error=${encodeURIComponent("A reason is required for manual pixel changes.")}`);

  const delta = deduct ? -amount : amount;
  const { error } = await db.rpc("adjust_user_pixels", {
    p_user_id: userId,
    p_amount: delta,
    p_reason: deduct ? "manual_deduction" : "manual_grant",
    p_created_by: `${by} — ${reason}`,
  });
  if (error) {
    console.error("adjustPixels failed", error.message);
    redirect(`/pixels?error=${encodeURIComponent("Couldn't adjust pixels — try again.")}`);
  }
  await logModAction(
    userId,
    deduct ? "pixels_deducted" : "pixels_granted",
    `${deduct ? "-" : "+"}${amount} pixels — ${reason}`,
    by,
  );
  const title = deduct ? "Pixels deducted" : "Pixels granted";
  const body = `${deduct ? `${amount} pixels were removed from` : `${amount} pixels were added to`} your balance by the Pixl team.\n\nReason: ${reason}\n\nIf you think this is a mistake, contact the Pixl team.`;
  const { error: notifyError } = await db
    .from("notifications")
    .insert({ user_id: userId, title, body });
  if (notifyError) console.error("adjustPixels notification failed", notifyError.message);

  await dmOrEmail(userId, title, body);
  revalidatePath("/pixels");
  redirect("/pixels?adjusted=1");
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

  const { data: target } = await db.from("projects").select("user_id").eq("id", projectId).single();
  if (target && (await isOwnProject(access, target.user_id)))
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("You can't act on your own project.")}`);

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

  await dmOrEmail(project.user_id, "Project rejected", body);
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

  const { data: target } = await db.from("projects").select("user_id").eq("id", projectId).single();
  if (target && (await isOwnProject(access, target.user_id)))
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("You can't act on your own project.")}`);

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

  await dmOrEmail(project.user_id, "Project banned", body);
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
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  const hours = Number(formData.get("hours") ?? 0);
  if (!userId || !reason) return;

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

  const lines = [
    expiresAt
      ? `You've been temporarily banned from Pixl until ${new Date(expiresAt).toUTCString()}.`
      : "You've been permanently banned from Pixl.",
  ];
  if (reason) lines.push(`Reason: ${reason}`);
  lines.push("If you believe this is a mistake, reach out to the Pixl team.");
  await dmOrEmail(userId, "Banned from Pixl", lines.join("\n\n"));
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
    await dmOrEmail(
      userId,
      "Ban lifted",
      [
        "Your ban from Pixl has been lifted. You're welcome to rejoin the game.",
        "Please keep the community guidelines in mind going forward.",
      ].join("\n\n"),
    );
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

export interface PlayerHit {
  id: string;
  name: string;
  hasSlack: boolean;
}

// Typeahead for the notify page: find players by display name so an admin can
// pick one instead of guessing the exact spelling.
export async function searchPlayers(query: string): Promise<PlayerHit[]> {
  await requirePerm("notify");
  const clean = query.replace(/[%_,()\\]/g, " ").trim();
  if (clean.length < 2) return [];
  const { data, error } = await db
    .from("users")
    .select("id, display_name, slack_id")
    .ilike("display_name", `%${clean}%`)
    .order("display_name", { ascending: true })
    .limit(8);
  if (error) {
    console.error("searchPlayers", error.message);
    return [];
  }
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name: (u.display_name as string) ?? "(unnamed)",
    hasSlack: Boolean(u.slack_id),
  }));
}

function readSubadminPerms(formData: FormData, existing: string[]): string[] {
  const perms = formData
    .getAll("perms")
    .map(String)
    .filter((p) => (SUBADMIN_PERMISSIONS as readonly string[]).includes(p));
  if (existing.includes("review")) perms.push("review");
  return perms;
}

async function logTeamChange(
  slackId: string,
  name: string,
  action: string,
  before: string[],
  after: string[],
  actor: string,
): Promise<void> {
  const { error } = await db.from("team_log").insert({
    slack_id: slackId,
    name,
    action,
    before,
    after,
    actor,
  });
  if (error) console.error("team log insert failed", error.message);
}

// Set someone's team permissions: empty = off the team entirely. Every change
// lands in team_log so it can be undone.
async function setTeamPerms(
  slackId: string,
  name: string,
  permissions: string[],
  action: string,
  actor: string,
  addedBy?: string,
): Promise<void> {
  const existing = await getAdmin(slackId);
  if (permissions.length === 0) {
    if (!existing) return;
    const { error } = await db.from("admins").delete().eq("slack_id", slackId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("admins").upsert({
      slack_id: slackId,
      name: name || existing?.name || slackId,
      permissions,
      added_by: existing?.added_by || addedBy || "",
    });
    if (error) throw new Error(error.message);
  }
  await logTeamChange(
    slackId,
    name || existing?.name || slackId,
    action,
    existing?.permissions ?? [],
    permissions,
    actor,
  );
  revalidatePath("/admins");
  revalidatePath("/reviewers");
}

export async function addAdmin(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!slackId) return;
  const existing = await getAdmin(slackId);
  await setTeamPerms(
    slackId,
    name,
    readSubadminPerms(formData, existing?.permissions ?? []),
    existing ? "updated" : "added",
    actorName(access),
    actorName(access),
  );
}

export async function updateAdminPerms(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  if (!slackId) return;
  const existing = await getAdmin(slackId);
  if (!existing) return;
  await setTeamPerms(
    slackId,
    existing.name,
    readSubadminPerms(formData, existing.permissions),
    "updated",
    actorName(access),
  );
}

export async function removeAdmin(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  if (!slackId) return;
  const existing = await getAdmin(slackId);
  if (!existing) return;
  await setTeamPerms(
    slackId,
    existing.name,
    existing.permissions.includes("review") ? ["review"] : [],
    "removed",
    actorName(access),
  );
}

function isEnvReviewer(slackId: string): boolean {
  return ownerSlackIds().includes(slackId) || secondPassSlackIds().includes(slackId);
}

export async function addReviewer(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!slackId) return;
  const existing = await getAdmin(slackId);
  const kept = (existing?.permissions ?? []).filter((p) => p !== NO_REVIEW);
  // Env admins review by default: lifting their block is enough, no row needed.
  const permissions = isEnvReviewer(slackId) ? kept : [...new Set([...kept, "review"])];
  await setTeamPerms(
    slackId,
    name,
    permissions,
    existing ? "updated" : "added",
    actorName(access),
    actorName(access),
  );
}

export async function removeReviewer(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const slackId = String(formData.get("slackId") ?? "").trim();
  if (!slackId) return;
  const existing = await getAdmin(slackId);
  if (!existing && !isEnvReviewer(slackId)) return;
  const permissions = (existing?.permissions ?? []).filter((p) => p !== "review");
  if (isEnvReviewer(slackId) && !permissions.includes(NO_REVIEW)) permissions.push(NO_REVIEW);
  await setTeamPerms(
    slackId,
    existing?.name ?? "",
    permissions,
    "removed",
    actorName(access),
    actorName(access),
  );
  redirect("/reviewers");
}

export async function undoTeamChange(formData: FormData): Promise<void> {
  const access = await requireSuper();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const { data } = await db.from("team_log").select("*").eq("id", id).single();
  if (!data) return;
  await setTeamPerms(
    String(data.slack_id),
    String(data.name),
    (data.before ?? []) as string[],
    "undo",
    actorName(access),
    actorName(access),
  );
}
