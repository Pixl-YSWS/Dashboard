"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, logModAction } from "@/lib/db";
import { dmUser } from "@/lib/slack";
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

export async function reviewProject(formData: FormData): Promise<void> {
  const access = await requirePerm("review");
  const by = actorName(access);
  const projectId = Number(formData.get("projectId") ?? 0);
  const verdict = String(formData.get("verdict") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!projectId || (verdict !== "approved" && verdict !== "needs_changes")) return;
  if (verdict === "needs_changes" && !note)
    redirect(`/review?error=${encodeURIComponent("A note is required when sending a project back.")}`);

  const { data: project, error } = await db
    .from("projects")
    .update({ status: verdict, review_note: note })
    .eq("id", projectId)
    .eq("status", "shipped")
    .select("id, name, user_id")
    .single();
  if (error || !project) {
    console.error("reviewProject failed", error?.message);
    return;
  }

  const approved = verdict === "approved";
  const title = approved ? "Project approved!" : "Project needs changes";
  const body = approved
    ? `"${project.name}" passed review. Congrats on shipping!${note ? `\n\nReviewer note: ${note}` : ""}`
    : `"${project.name}" was sent back by a reviewer:\n\n${note}\n\nUpdate your project and ship it again.`;
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
