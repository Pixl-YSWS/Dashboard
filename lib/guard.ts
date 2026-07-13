import { redirect } from "next/navigation";
import { getSession, isAllowed, type AdminSession } from "./session";
import { getAdmin } from "./db";

export const ALL_PERMISSIONS = ["warn", "ban", "notify", "review"] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];

export interface AdminAccess {
  session: AdminSession;
  isSuper: boolean;
  perms: Set<string>;
}

// Owners come from the ADMIN_SLACK_IDS env allowlist and hold every
// permission; sub-admins live in the admins table with an explicit set.
export async function getAccess(): Promise<AdminAccess | null> {
  const session = await getSession();
  if (!session) return null;
  if (isAllowed(session.slackId))
    return { session, isSuper: true, perms: new Set(ALL_PERMISSIONS) };
  const row = await getAdmin(session.slackId);
  if (!row) return null;
  return { session, isSuper: false, perms: new Set(row.permissions) };
}

export async function requireAdmin(): Promise<AdminAccess> {
  const access = await getAccess();
  if (!access) redirect("/login");
  return access;
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
