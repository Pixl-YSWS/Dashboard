import { redirect } from "next/navigation";
import { getSession, isAllowed, type AdminSession } from "./session";
import { getAdmin } from "./db";

export const ALL_PERMISSIONS = ["warn", "ban", "notify", "review"] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

// Sub-admins are managed with these; "review" is granted from the Reviewers tab.
export const SUBADMIN_PERMISSIONS = ["warn", "ban", "notify"] as const;

export interface AdminAccess {
  session: AdminSession;
  isSuper: boolean;
  perms: Set<string>;
  canSecondPass: boolean;
}

function envIds(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ownerSlackIds(): string[] {
  return envIds("ADMIN_SLACK_IDS");
}

export function secondPassSlackIds(): string[] {
  return envIds("SECOND_PASS_SLACK_IDS");
}

// Final reviewers do the mandatory second pass and are the only ones who can
// approve (and credit pixels). Configured via SECOND_PASS_SLACK_IDS; if unset,
// only owners (ADMIN_SLACK_IDS) qualify.
export function isSecondPassReviewer(slackId: string): boolean {
  const ids = secondPassSlackIds();
  if (ids.length === 0) return isAllowed(slackId);
  return ids.includes(slackId);
}

// Owners come from the ADMIN_SLACK_IDS env allowlist and hold every
// permission; sub-admins live in the admins table with an explicit set.
export async function getAccess(): Promise<AdminAccess | null> {
  const session = await getSession();
  if (!session) return null;
  const canSecondPass = isSecondPassReviewer(session.slackId);
  if (isAllowed(session.slackId))
    return { session, isSuper: true, perms: new Set(ALL_PERMISSIONS), canSecondPass };
  const row = await getAdmin(session.slackId);
  if (!row) return null;
  return { session, isSuper: false, perms: new Set(row.permissions), canSecondPass };
}

// Signed-in users who lost their access land on /removed instead of the
// login screen, so they know it was on purpose (or who to ping if not).
export async function requireAdmin(): Promise<AdminAccess> {
  const access = await getAccess();
  if (access) return access;
  const session = await getSession();
  redirect(session ? "/removed" : "/login");
}

export function canView(access: AdminAccess, perms: Permission[]): boolean {
  return access.isSuper || perms.some((p) => access.perms.has(p));
}

// Page-level gate: sub-admins only reach pages matching one of their
// permissions; everyone else bounces back to the overview.
export async function requirePagePerm(perms: Permission[]): Promise<AdminAccess> {
  const access = await requireAdmin();
  if (!canView(access, perms)) redirect("/");
  return access;
}

export async function requirePerm(perm: Permission): Promise<AdminAccess> {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  if (!access.isSuper && !access.perms.has(perm))
    throw new Error(`You don't have the "${perm}" permission.`);
  return access;
}

export async function requireSuper(): Promise<AdminAccess> {
  const access = await getAccess();
  if (!access || !access.isSuper) throw new Error("Owners only.");
  return access;
}
