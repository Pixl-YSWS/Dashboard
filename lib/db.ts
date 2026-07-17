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
  pixels: number;
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
  hackatime_seconds: number;
  status: string;
  review_note: string;
  approved_hours: number | null;
  image_url: string;
  level: number;
  used_ai: boolean;
  is_update: boolean;
  update_notes: string;
  other_ysws: boolean;
  system_note: string;
  archived_at: string | null;
  rejected_at: string | null;
  reject_reason: string;
  reject_by: string;
  banned_at: string | null;
  ban_reason: string;
  ban_by: string;
  reviewing_by: string;
  reviewing_at: string | null;
  first_pass_by: string;
  first_pass_at: string | null;
  first_pass_note: string;
  first_pass_hours: number | null;
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
  const now = new Date();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const [
    players,
    projects,
    violations,
    violations7d,
    activeBans,
    playersToday,
    playersWeek,
    playersMonth,
    projectsWeek,
  ] = await Promise.all([
    count("users"),
    count("projects"),
    count("violations"),
    count("violations", (q) => q.gte("created_at", weekAgo)),
    count("bans", (q) =>
      q
        .is("lifted_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    ),
    count("users", (q) => q.gte("created_at", todayStart.toISOString())),
    count("users", (q) => q.gte("created_at", weekAgo)),
    count("users", (q) => q.gte("created_at", monthAgo)),
    count("projects", (q) => q.gte("created_at", weekAgo)),
  ]);
  return {
    players,
    projects,
    violations,
    violations7d,
    activeBans,
    playersToday,
    playersWeek,
    playersMonth,
    projectsWeek,
  };
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
  users?: Pick<UserRow, "id" | "display_name" | "slack_id"> | null;
}

export interface ShippedProject extends ProjectWithUser {
  hours: number;
  hackatimeHours: number;
  journalHours: number;
  entries: number;
}

async function hydrateHours(projects: ShippedProject[]): Promise<ShippedProject[]> {
  if (projects.length === 0) return projects;
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
    p.journalHours = Math.round(cur.h * 10) / 10;
    p.hackatimeHours = Math.round(((p.hackatime_seconds ?? 0) / 3600) * 10) / 10;
    p.hours = p.hackatimeHours > 0 ? p.hackatimeHours : p.journalHours;
    p.entries = cur.n;
  }
  return projects;
}

// A project claimed by another reviewer stays hidden from the queue for this long.
export const REVIEW_LOCK_MS = 15 * 60 * 1000;

function claimedByOther(p: ShippedProject, viewer?: string): boolean {
  if (!p.reviewing_by || p.reviewing_by === viewer) return false;
  if (!p.reviewing_at) return false;
  return Date.now() - new Date(p.reviewing_at).getTime() < REVIEW_LOCK_MS;
}

// A reviewer must never see or grade their own submission.
function ownedByViewer(p: ShippedProject, viewer?: string): boolean {
  return !!viewer && !!p.users?.slack_id && p.users.slack_id === viewer;
}

// Review queue: shipped projects oldest-first, hiding anything another reviewer
// is currently reviewing.
export async function listShippedProjects(viewer?: string): Promise<ShippedProject[]> {
  const { data, error } = await db
    .from("projects")
    .select("*, users(id, display_name, slack_id)")
    .eq("status", "shipped")
    .is("archived_at", null)
    .is("rejected_at", null)
    .is("banned_at", null)
    .order("shipped_at", { ascending: true })
    .limit(500);
  if (error) {
    console.error("listShippedProjects", error.message);
    return [];
  }
  const visible = (data ?? []).filter(
    (p) =>
      !claimedByOther(p as ShippedProject, viewer) &&
      !ownedByViewer(p as ShippedProject, viewer),
  );
  return hydrateHours(visible as ShippedProject[]);
}

// Claim a submission for a reviewer. Returns { ok:false, by } if someone else
// holds an active claim.
export async function claimReview(
  projectId: number,
  viewer: string,
): Promise<{ ok: boolean; by?: string }> {
  const { data } = await db
    .from("projects")
    .select("reviewing_by, reviewing_at")
    .eq("id", projectId)
    .single();
  const by = (data?.reviewing_by as string) || "";
  const at = (data?.reviewing_at as string | null) ?? null;
  const active =
    by && by !== viewer && at && Date.now() - new Date(at).getTime() < REVIEW_LOCK_MS;
  if (active) return { ok: false, by };
  await db
    .from("projects")
    .update({ reviewing_by: viewer, reviewing_at: new Date().toISOString() })
    .eq("id", projectId);
  if (by !== viewer) void notifyReviewStarted(projectId);
  return { ok: true };
}

// Tell the owner their project is being looked at right now — at most once
// every 6 hours per project so queue browsing doesn't spam them.
async function notifyReviewStarted(projectId: number): Promise<void> {
  const { data: p } = await db
    .from("projects")
    .select("name, user_id, status")
    .eq("id", projectId)
    .single();
  if (!p || (p.status !== "shipped" && p.status !== "second_review")) return;
  const since = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { count } = await db
    .from("mod_actions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", p.user_id)
    .eq("action", "review_started")
    .eq("detail", p.name)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;
  await db
    .from("mod_actions")
    .insert({ user_id: p.user_id, action: "review_started", detail: p.name, actor: "system" });
  await db.from("notifications").insert({
    user_id: p.user_id,
    title: "Your project is being reviewed",
    body: `A reviewer is looking at "${p.name}" right now. You'll get the verdict here soon. 👀`,
  });
}

// Second-pass queue: projects that passed a first review and await a final
// reviewer's sign-off, oldest-first, hiding anything another reviewer holds.
export async function listSecondReviewProjects(viewer?: string): Promise<ShippedProject[]> {
  const { data, error } = await db
    .from("projects")
    .select("*, users(id, display_name, slack_id)")
    .eq("status", "second_review")
    .is("archived_at", null)
    .is("rejected_at", null)
    .is("banned_at", null)
    .order("first_pass_at", { ascending: true })
    .limit(500);
  if (error) {
    console.error("listSecondReviewProjects", error.message);
    return [];
  }
  const visible = (data ?? []).filter((p) => !claimedByOther(p as ShippedProject, viewer));
  return hydrateHours(visible as ShippedProject[]);
}

// Credit a project's approval to the owner's pixel balance exactly once. The
// atomic insert-and-increment lives in a Postgres function so the game can
// never write pixels and repeats can't double-credit.
export async function creditProjectPixels(
  userId: string,
  projectId: number,
  amount: number,
  hours: number,
  by: string,
): Promise<void> {
  const { error } = await db.rpc("credit_project_pixels", {
    p_user_id: userId,
    p_project_id: projectId,
    p_amount: amount,
    p_hours: hours,
    p_created_by: by,
  });
  if (error) console.error("creditProjectPixels", error.message);
}

// Claw back everything a project was credited (verdict reverted). Returns the
// number of pixels removed, for logging.
export async function revokeProjectPixels(
  userId: string,
  projectId: number,
  by: string,
): Promise<number> {
  const { data, error } = await db.rpc("revoke_project_pixels", {
    p_user_id: userId,
    p_project_id: projectId,
    p_created_by: by,
  });
  if (error) {
    console.error("revokeProjectPixels", error.message);
    return 0;
  }
  return Number(data) || 0;
}

// Net pixels a project has been credited so far (for delta display).
export async function projectPixelTotal(projectId: number): Promise<number> {
  const { data, error } = await db
    .from("pixel_transactions")
    .select("amount")
    .eq("project_id", projectId)
    .in("reason", ["project_approved", "review_reverted"]);
  if (error) {
    console.error("projectPixelTotal", error.message);
    return 0;
  }
  return (data ?? []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

// Reviewed: projects that already got a verdict, most-recent first.
export async function listReviewedProjects(): Promise<ShippedProject[]> {
  const { data, error } = await db
    .from("projects")
    .select("*, users(id, display_name, slack_id)")
    .in("status", ["approved", "needs_changes"])
    .is("archived_at", null)
    .order("shipped_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("listReviewedProjects", error.message);
    return [];
  }
  return hydrateHours((data ?? []) as ShippedProject[]);
}

export async function countPendingReviews(): Promise<number> {
  const { count, error } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .in("status", ["shipped", "second_review"])
    .is("archived_at", null)
    .is("rejected_at", null)
    .is("banned_at", null);
  if (error) {
    console.error("countPendingReviews", error.message);
    return 0;
  }
  return count ?? 0;
}

async function attachPlayerNames(rows: (ModActionRow & { player_name?: string })[]) {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return;
  const { data: users } = await db.from("users").select("id, display_name").in("id", ids);
  const names = new Map((users ?? []).map((u) => [u.id as string, u.display_name as string]));
  for (const r of rows) r.player_name = names.get(r.user_id) ?? r.user_id;
}

function detailMatchesProject(detail: string, name: string): boolean {
  return detail === name || detail.startsWith(`${name}:`);
}

export interface ReviewAuditRow {
  id: number;
  project_id: number;
  user_id: string;
  reviewer: string;
  verdict: string;
  note: string;
  claimed_hours: number;
  approved_hours: number | null;
  repo_opened: boolean;
  demo_opened: boolean;
  repo_seconds: number;
  demo_seconds: number;
  total_seconds: number;
  created_at: string;
  player_name: string;
  project_name: string;
}

export async function listReviewAudits(limit = 50): Promise<ReviewAuditRow[]> {
  const { data, error } = await db
    .from("review_audits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listReviewAudits", error.message);
    return [];
  }
  const rows = (data ?? []) as ReviewAuditRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const projectIds = [...new Set(rows.map((r) => r.project_id))];
  const [users, projects] = await Promise.all([
    userIds.length > 0
      ? db.from("users").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? db.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const names = new Map((users.data ?? []).map((u) => [u.id as string, u.display_name as string]));
  const projectNames = new Map((projects.data ?? []).map((p) => [p.id as number, p.name as string]));
  for (const r of rows) {
    r.player_name = names.get(r.user_id) ?? r.user_id;
    r.project_name = projectNames.get(r.project_id) ?? `#${r.project_id}`;
  }
  return rows;
}

export interface ReviewerStats {
  reviews: number;
  approved: number;
  firstPass: number;
  needsChanges: number;
  hoursApproved: number;
  avgSeconds: number;
  repoOpenRate: number;
  lastReview: string | null;
}

function emptyReviewerStats(): ReviewerStats {
  return {
    reviews: 0,
    approved: 0,
    firstPass: 0,
    needsChanges: 0,
    hoursApproved: 0,
    avgSeconds: 0,
    repoOpenRate: 0,
    lastReview: null,
  };
}

// Audits store the reviewer as "Name (SLACKID)" — aggregate per slack id.
export async function reviewerStatsBySlackId(): Promise<Map<string, ReviewerStats>> {
  const rows: {
    reviewer: string;
    verdict: string;
    approved_hours: number | null;
    total_seconds: number;
    repo_opened: boolean;
    created_at: string;
  }[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from("review_audits")
      .select("reviewer, verdict, approved_hours, total_seconds, repo_opened, created_at")
      .order("created_at", { ascending: true })
      .range(from, from + page - 1);
    if (error) {
      console.error("reviewerStatsBySlackId", error.message);
      break;
    }
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < page) break;
  }

  const out = new Map<string, ReviewerStats>();
  const timed = new Map<string, { total: number; n: number; repoOpened: number }>();
  for (const r of rows) {
    const key = /\(([^)]+)\)\s*$/.exec(r.reviewer)?.[1] ?? r.reviewer;
    const s = out.get(key) ?? emptyReviewerStats();
    const t = timed.get(key) ?? { total: 0, n: 0, repoOpened: 0 };
    s.reviews++;
    if (r.verdict === "approved") {
      s.approved++;
      s.hoursApproved += Number(r.approved_hours) || 0;
    } else if (r.verdict === "first_pass_approved") s.firstPass++;
    else if (r.verdict === "needs_changes") s.needsChanges++;
    if (r.total_seconds > 0) {
      t.total += r.total_seconds;
      t.n++;
    }
    if (r.repo_opened) t.repoOpened++;
    if (!s.lastReview || r.created_at > s.lastReview) s.lastReview = r.created_at;
    out.set(key, s);
    timed.set(key, t);
  }
  for (const [key, s] of out) {
    const t = timed.get(key)!;
    s.avgSeconds = t.n > 0 ? Math.round(t.total / t.n) : 0;
    s.repoOpenRate = s.reviews > 0 ? t.repoOpened / s.reviews : 0;
  }
  return out;
}

export interface PixelTxRow {
  id: number;
  user_id: string;
  project_id: number | null;
  amount: number;
  hours: number;
  reason: string;
  created_by: string;
  created_at: string;
  player_name: string;
  project_name: string | null;
}

// The pixel ledger, newest first: every credit (and, later, spend). amount is
// signed — positive is pixels given out, negative is spent.
export async function listPixelTransactions(limit = 1000): Promise<PixelTxRow[]> {
  const { data, error } = await db
    .from("pixel_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listPixelTransactions", error.message);
    return [];
  }
  const rows = (data ?? []) as PixelTxRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const projectIds = [
    ...new Set(rows.map((r) => r.project_id).filter((x): x is number => x != null)),
  ];
  const [users, projects] = await Promise.all([
    userIds.length > 0
      ? db.from("users").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? db.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const names = new Map((users.data ?? []).map((u) => [u.id as string, u.display_name as string]));
  const pnames = new Map((projects.data ?? []).map((p) => [p.id as number, p.name as string]));
  for (const r of rows) {
    r.player_name = names.get(r.user_id) ?? r.user_id;
    r.project_name = r.project_id != null ? (pnames.get(r.project_id) ?? `#${r.project_id}`) : null;
  }
  return rows;
}

export interface BanLogRow extends ModActionRow {
  player_name: string;
}

export async function listBanLog(limit = 100): Promise<BanLogRow[]> {
  const { data, error } = await db
    .from("mod_actions")
    .select("*")
    .in("action", ["ban", "unban"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listBanLog", error.message);
    return [];
  }
  const rows = (data ?? []) as BanLogRow[];
  await attachPlayerNames(rows);
  return rows;
}

export interface JournalRow {
  id: number;
  project_id: number;
  user_id: string;
  content: string;
  hours: number;
  created_at: string;
}

export async function getProject(id: number) {
  const { data, error } = await db
    .from("projects")
    .select("*, users(id, display_name, slack_id)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const project = data as ProjectWithUser;
  const [journals, actions] = await Promise.all([
    db
      .from("project_journals")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("mod_actions")
      .select("*")
      .eq("user_id", project.user_id)
      .in("action", ["project_approved", "project_needs_changes", "review_reverted"])
      .order("created_at", { ascending: false }),
  ]);
  const verdicts = ((actions.data ?? []) as ModActionRow[]).filter((a) =>
    detailMatchesProject(a.detail, project.name),
  );
  return {
    project,
    journals: (journals.data ?? []) as JournalRow[],
    verdicts,
  };
}

export async function listProjects(
  query?: string,
  opts: { archived?: boolean } = {},
): Promise<ProjectWithUser[]> {
  let q = db
    .from("projects")
    .select("*, users(id, display_name, slack_id)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (opts.archived) q = q.not("archived_at", "is", null);
  else q = q.is("archived_at", null);
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

export interface SearchResults {
  players: { id: string; display_name: string; slack_id: string | null }[];
  projects: { id: number; name: string; status: string; user_id: string }[];
}

export async function globalSearch(
  query: string,
  opts: { players: boolean; projects: boolean },
): Promise<SearchResults> {
  const clean = query.replace(/[,()%*\\]/g, " ").trim();
  if (clean.length < 2) return { players: [], projects: [] };
  const like = `%${clean}%`;

  const [playersRes, projectsRes] = await Promise.all([
    opts.players
      ? db
          .from("users")
          .select("id, display_name, slack_id")
          .or(`display_name.ilike.${like},slack_id.ilike.${like}`)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
    opts.projects
      ? db
          .from("projects")
          .select("id, name, status, user_id")
          .is("archived_at", null)
          .ilike("name", like)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (playersRes.error) console.error("globalSearch players", playersRes.error.message);
  if (projectsRes.error) console.error("globalSearch projects", projectsRes.error.message);

  return {
    players: (playersRes.data ?? []) as SearchResults["players"],
    projects: (projectsRes.data ?? []) as SearchResults["projects"],
  };
}
