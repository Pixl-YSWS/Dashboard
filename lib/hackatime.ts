import type { Commit } from "@/lib/github";

const BASE = (process.env.HACKATIME_BASE ?? "https://hackatime.hackclub.com").replace(/\/$/, "");

export interface Span {
  start: number;
  end: number;
}

// Coding spans for a user's linked Hackatime projects, oldest first. Uses the
// player's stored OAuth token so private stats resolve too; falls back to the
// public endpoint. Null when Hackatime is unreachable or nothing is linked.
export async function fetchUserSpans(
  slackId: string | null | undefined,
  token: string | null,
  projects: string[],
): Promise<Span[] | null> {
  const id = (slackId ?? "").trim();
  if (!id || projects.length === 0) return null;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url =
    `${BASE}/api/v1/users/${encodeURIComponent(id)}/heartbeats/spans` +
    `?filter_by_project=${encodeURIComponent(projects.join(","))}`;
  try {
    const r = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    const json = (await r.json()) as {
      spans?: { start_time?: number; end_time?: number }[];
    };
    return (json.spans ?? [])
      .map((s) => ({ start: Number(s.start_time) || 0, end: Number(s.end_time) || 0 }))
      .filter((s) => s.end > s.start)
      .sort((a, b) => a.start - b.start);
  } catch (e) {
    console.error("hackatime spans fetch failed", (e as Error).message);
    return null;
  }
}

function overlap(spans: Span[], from: number, to: number): number {
  let sum = 0;
  for (const s of spans) {
    if (s.end <= from) continue;
    if (s.start >= to) break;
    sum += Math.min(s.end, to) - Math.max(s.start, from);
  }
  return Math.max(0, Math.round(sum));
}

// Attribute tracked coding time to each commit: the seconds of Hackatime spans
// between the previous fetched commit and this one. The oldest fetched commit
// stays unknown (its window extends past what we fetched). Commits with ~zero
// tracked time behind them are a fraud signal — code appeared without coding.
export function attachTrackedTime(commits: Commit[], spans: Span[]): void {
  const dated = commits
    .filter((c) => c.date)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < dated.length; i++) {
    const from = new Date(dated[i - 1].date).getTime() / 1000;
    const to = new Date(dated[i].date).getTime() / 1000;
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) continue;
    dated[i].tracked = overlap(spans, from, to);
  }
}
