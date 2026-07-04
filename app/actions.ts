"use server";

import { revalidatePath } from "next/cache";
import { db, logModAction } from "@/lib/db";
import { dmUser } from "@/lib/slack";
import { getSession } from "@/lib/session";

const DEFAULT_WARNING =
  "Hey! A heads-up from the Pixl team: keep chat messages and display names friendly. Continued violations can lead to a ban from the game.";

async function actor(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in");
  return `${session.name} (${session.slackId})`;
}

export async function warnPlayer(formData: FormData): Promise<void> {
  const by = await actor();
  const userId = String(formData.get("userId") ?? "");
  const message = String(formData.get("message") ?? "").trim() || DEFAULT_WARNING;
  if (!userId) return;

  const { data } = await db
    .from("users")
    .select("slack_id, display_name")
    .eq("id", userId)
    .single();
  if (!data?.slack_id) {
    await logModAction(userId, "warn_failed", "No slack_id on file", by);
    revalidatePath("/", "layout");
    return;
  }
  await dmUser(data.slack_id, `⚠️ *Pixl moderation* — ${message}`);
  await logModAction(userId, "warn", message, by);
  revalidatePath("/", "layout");
}

export async function banPlayer(formData: FormData): Promise<void> {
  const by = await actor();
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
    const until = expiresAt
      ? `until ${new Date(expiresAt).toUTCString()}`
      : "permanently";
    try {
      await dmUser(
        data.slack_id,
        `🚫 *Pixl moderation* — you've been banned ${until}.${reason ? ` Reason: ${reason}` : ""}`,
      );
    } catch (e) {
      console.error("ban DM failed", e);
    }
  }
  revalidatePath("/", "layout");
}

export async function liftBan(formData: FormData): Promise<void> {
  const by = await actor();
  const banId = Number(formData.get("banId") ?? 0);
  const userId = String(formData.get("userId") ?? "");
  if (!banId) return;
  const { error } = await db
    .from("bans")
    .update({ lifted_at: new Date().toISOString() })
    .eq("id", banId);
  if (error) throw new Error(error.message);
  if (userId) await logModAction(userId, "unban", `ban #${banId} lifted`, by);
  revalidatePath("/", "layout");
}
