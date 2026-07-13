import { createClient } from "@supabase/supabase-js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const db = createClient(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_KEY"),
  { auth: { persistSession: false } },
);

export interface UserRow {
  id: string;
  oauth_provider: string;
  oauth_id: string;
  display_name: string;
  avatar_url: string | null;
  skin: string;
  slack_id: string | null;
  created_at: string;
}

export interface ViolationRow {
  id: number;
  user_id: string;
  kind: string;
  content: string;
  created_at: string;
  users?: Pick<UserRow, "id" | "display_name" | "slack_id"> | null;
}

export interface BanRow {
  id: number;
  user_id: string;
  reason: string;
  banned_by: string;
  expires_at: string | null;
  lifted_at: string | null;
  created_at: string;
  users?: Pick<UserRow, "id" | "display_name"> | null;
}

export interface ProjectRow {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  repo_url: string | null;
  demo_url: string | null;
  hackatime_projects: string[];
  status: string;
  type: string;
  review_note: string;
  shipped_at: string | null;
  created_at: string;
}

export interface PlayerStateRow {
  user_id: string;
  scene: string;
  pos_x: number;
  pos_y: number;
  direction: string;
  updated_at: string;
}

export interface ModActionRow {
  id: number;
  user_id: string;
  action: string;
  detail: string;
  actor: string;
  created_at: string;
}

export interface AdminRow {
  slack_id: string;
  name: string;
  permissions: string[];
  added_by: string;
  created_at: string;
}

export async function getAdmin(slackId: string): Promise<AdminRow | null> {
  const { data, error } = await db
    .from("admins")
    .select("*")
    .eq("slack_id", slackId)
    .maybeSingle();
  if (error) {
    console.error("getAdmin", error.message);
    return null;
  }
  return (data as AdminRow) ?? null;
}

export async function listAdmins(): Promise<AdminRow[]> {
  const { data, error } = await db
    .from("admins")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listAdmins", error.message);
    return [];
  }
  return (data ?? []) as AdminRow[];
}

export function banIsActive(b: BanRow): boolean {
  if (b.lifted_at) return false;
  if (!b.expires_at) return true;
  return new Date(b.expires_at).getTime() > Date.now();
}

async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) return 0;
  return n ?? 0;
}

export async function getStats() {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [players, projects, violations, violations7d, activeBans, playersWeek, projectsWeek] =
    await Promise.all([
      count("users"),
      count("projects"),
      count("violations"),
      count("violations", (q) => q.gte("created_at", weekAgo)),
      count("bans", (q) =>
        q
          .is("lifted_at", null)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      ),
      count("users", (q) => q.gte("created_at", weekAgo)),
      count("projects", (q) => q.gte("created_at", weekAgo)),
    ]);
  return { players, projects, violations, violations7d, activeBans, playersWeek, projectsWeek };
}

export interface GrowthPoint {
  date: string;
  total: number;
  added: number;
}

async function fetchCreatedAts(table: string): Promise<string[]> {
  const out: string[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from(table)
      .select("created_at")
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) {
      console.error("fetchCreatedAts", table, error.message);
      break;
    }
    const rows = data ?? [];
    for (const r of rows) out.push(r.created_at as string);
    if (rows.length < page) break;
  }
  return out;
}

function bucketDaily(dates: string[], days: number): GrowthPoint[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * 86400_000;
  const counts = new Map<string, number>();
  let before = 0;
  for (const iso of dates) {
    if (new Date(iso).getTime() < start) {
      before++;
      continue;
    }
    const key = new Date(iso).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: GrowthPoint[] = [];
  let total = before;
  for (let i = 0; i < days; i++) {
    const key = new Date(start + i * 86400_000).toISOString().slice(0, 10);
    const added = counts.get(key) ?? 0;
    total += added;
    points.push({ date: key, total, added });
  }
  return points;
}

export async function getGrowthSeries(days = 30) {
  const [users, projects, violations] = await Promise.all([
    fetchCreatedAts("users"),
    fetchCreatedAts("projects"),
    fetchCreatedAts("violations"),
  ]);
  return {
    players: bucketDaily(users, days),
    projects: bucketDaily(projects, days),
    violations: bucketDaily(violations, days),
  };
}

export interface ProjectWithUser extends ProjectRow {
  users?: Pick<UserRow, "id" | "display_name"> | null;
}

export interface ShippedProject extends ProjectWithUser {
  hours: number;
  entries: number;
}

// Review queue: shipped projects oldest-first, with journal effort totals.
export async function listShippedProjects(): Promise<ShippedProject[]> {
  const { data, error } = await db
    .from("projects")
    .select("*, users(id, display_name)")
    .eq("status", "shipped")
    .order("shipped_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("listShippedProjects", error.message);
    return [];
  }
  const projects = (data ?? []) as ShippedProject[];
  if (projects.length === 0) return [];

  const { data: journals } = await db
    .from("project_journals")
    .select("project_id, hours")
    .in("project_id", projects.map((p) => p.id));
  const totals = new Map<number, { h: number; n: number }>();
  for (const j of journals ?? []) {
    const cur = totals.get(j.project_id as number) ?? { h: 0, n: 0 };
    cur.h += Number(j.hours) || 0;
    cur.n += 1;
    totals.set(j.project_id as number, cur);
  }
  for (const p of projects) {
    const cur = totals.get(p.id) ?? { h: 0, n: 0 };
    p.hours = Math.round(cur.h * 10) / 10;
    p.entries = cur.n;
  }
  return projects;
}

export interface ReviewLogRow extends ModActionRow {
  player_name: string;
}

// Verdict history for the review log, newest first.
export async function listReviewLog(limit = 50): Promise<ReviewLogRow[]> {
  const { data, error } = await db
    .from("mod_actions")
    .select("*")
    .in("action", ["project_approved", "project_needs_changes"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listReviewLog", error.message);
    return [];
  }
  const rows = (data ?? []) as ReviewLogRow[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length > 0) {
    const { data: users } = await db.from("users").select("id, display_name").in("id", ids);
    const names = new Map((users ?? []).map((u) => [u.id as string, u.display_name as string]));
    for (const r of rows) r.player_name = names.get(r.user_id) ?? r.user_id;
  }
  return rows;
}

export async function listProjects(query?: string): Promise<ProjectWithUser[]> {
  let q = db
    .from("projects")
    .select("*, users(id, display_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (query) q = q.ilike("name", `%${query}%`);
  const { data, error } = await q;
  if (error) {
    console.error("listProjects", error.message);
    return [];
  }
  return (data ?? []) as ProjectWithUser[];
}

export async function listBans(): Promise<BanRow[]> {
  const { data, error } = await db
    .from("bans")
    .select("*, users(id, display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listBans", error.message);
    return [];
  }
  return (data ?? []) as BanRow[];
}

export async function listViolations(limit = 100): Promise<ViolationRow[]> {
  const { data, error } = await db
    .from("violations")
    .select("*, users(id, display_name, slack_id)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listViolations", error.message);
    return [];
  }
  return (data ?? []) as ViolationRow[];
}

export async function listPlayers(query?: string): Promise<
  (UserRow & { projectCount: number; violationCount: number; activeBan: BanRow | null })[]
> {
  let q = db.from("users").select("*").order("created_at", { ascending: false }).limit(500);
  if (query) q = q.ilike("display_name", `%${query}%`);
  const { data, error } = await q;
  if (error) {
    console.error("listPlayers", error.message);
    return [];
  }
  const users = (data ?? []) as UserRow[];

  const [projects, violations, bans] = await Promise.all([
    db.from("projects").select("user_id"),
    db.from("violations").select("user_id"),
    db.from("bans").select("*").is("lifted_at", null),
  ]);
  const projCounts = new Map<string, number>();
  for (const p of projects.data ?? [])
    projCounts.set(p.user_id, (projCounts.get(p.user_id) ?? 0) + 1);
  const vioCounts = new Map<string, number>();
  for (const v of violations.data ?? [])
    vioCounts.set(v.user_id, (vioCounts.get(v.user_id) ?? 0) + 1);
  const activeBans = new Map<string, BanRow>();
  for (const b of (bans.data ?? []) as BanRow[])
    if (banIsActive(b)) activeBans.set(b.user_id, b);

  return users.map((u) => ({
    ...u,
    projectCount: projCounts.get(u.id) ?? 0,
    violationCount: vioCounts.get(u.id) ?? 0,
    activeBan: activeBans.get(u.id) ?? null,
  }));
}

export async function getPlayer(id: string) {
  const [user, states, projects, violations, bans, actions] = await Promise.all([
    db.from("users").select("*").eq("id", id).single(),
    db.from("player_state").select("*").eq("user_id", id).order("updated_at", { ascending: false }),
    db.from("projects").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("violations").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("bans").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("mod_actions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  if (user.error || !user.data) return null;
  return {
    user: user.data as UserRow,
    states: (states.data ?? []) as PlayerStateRow[],
    projects: (projects.data ?? []) as ProjectRow[],
    violations: (violations.data ?? []) as ViolationRow[],
    bans: (bans.data ?? []) as BanRow[],
    actions: (actions.data ?? []) as ModActionRow[],
  };
}

export async function logModAction(
  userId: string,
  action: string,
  detail: string,
  actor: string,
): Promise<void> {
  const { error } = await db
    .from("mod_actions")
    .insert({ user_id: userId, action, detail, actor });
  if (error) console.error("logModAction", error.message);
}
