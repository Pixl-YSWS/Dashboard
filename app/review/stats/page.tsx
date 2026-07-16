import { requirePagePerm } from "@/lib/guard";
import { db, type ReviewAuditRow } from "@/lib/db";
import { ReviewTabs } from "@/app/_components/ReviewTabs";

export const dynamic = "force-dynamic";

interface ReviewerStats {
  reviewer: string;
  total: number;
  approved: number;
  firstPass: number;
  changes: number;
  reverted: number;
  hoursCredited: number;
  avgSeconds: number;
  repoOpenedPct: number;
  demoOpenedPct: number;
  lastActive: string;
}

function fmtDur(secs: number): string {
  if (secs <= 0) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  return `${(secs / 3600).toFixed(1)}h`;
}

export default async function ReviewStatsPage() {
  const access = await requirePagePerm(["review"]);
  const { data, error } = await db
    .from("review_audits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) console.error("review stats", error.message);
  let audits = (data ?? []) as ReviewAuditRow[];
  if (!access.isSuper)
    audits = audits.filter((a) => a.reviewer.includes(access.session.slackId));

  const byReviewer = new Map<string, ReviewAuditRow[]>();
  for (const a of audits) {
    const list = byReviewer.get(a.reviewer) ?? [];
    list.push(a);
    byReviewer.set(a.reviewer, list);
  }
  const stats: ReviewerStats[] = [...byReviewer.entries()].map(([reviewer, rows]) => {
    const approved = rows.filter((r) => r.verdict === "approved");
    const timed = rows.filter((r) => (r.total_seconds ?? 0) > 0);
    return {
      reviewer,
      total: rows.length,
      approved: approved.length,
      firstPass: rows.filter((r) => r.verdict === "first_pass_approved").length,
      changes: rows.filter((r) => r.verdict === "needs_changes").length,
      reverted: rows.filter((r) => r.verdict === "reverted").length,
      hoursCredited:
        Math.round(approved.reduce((s, r) => s + (Number(r.approved_hours) || 0), 0) * 10) / 10,
      avgSeconds:
        timed.length > 0
          ? timed.reduce((s, r) => s + r.total_seconds, 0) / timed.length
          : 0,
      repoOpenedPct:
        rows.length > 0
          ? Math.round((rows.filter((r) => r.repo_opened).length / rows.length) * 100)
          : 0,
      demoOpenedPct:
        rows.length > 0
          ? Math.round((rows.filter((r) => r.demo_opened).length / rows.length) * 100)
          : 0,
      lastActive: rows[0]?.created_at ?? "",
    };
  });
  stats.sort((a, b) => b.total - a.total);

  return (
    <div>
      <ReviewTabs isSuper={access.isSuper} />
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-1">
        {access.isSuper ? "Reviewer stats" : "Your review stats"}
      </h1>
      <p className="text-sm text-ink/55 mb-5">
        From the review audit log — verdicts, hours credited, time spent per review, and whether
        the repo/demo were actually opened.
      </p>

      {stats.length === 0 ? (
        <div className="pixl-card p-8 text-center text-ink/55 text-sm">No reviews logged yet.</div>
      ) : (
        <div className="pixl-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--line)] text-ink/60">
                <th className="p-3 font-medium">Reviewer</th>
                <th className="p-3 font-medium">Reviews</th>
                <th className="p-3 font-medium">Approved</th>
                <th className="p-3 font-medium">First pass</th>
                <th className="p-3 font-medium">Changes</th>
                <th className="p-3 font-medium">Hours credited</th>
                <th className="p-3 font-medium" title="Average time spent on the review page per verdict">
                  Avg time
                </th>
                <th className="p-3 font-medium" title="How often the repo / demo were actually opened">
                  Repo / demo
                </th>
                <th className="p-3 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {stats.map((s) => (
                <tr key={s.reviewer}>
                  <td className="p-3 font-medium break-words">{s.reviewer}</td>
                  <td className="p-3 tabular-nums">{s.total}</td>
                  <td className="p-3 tabular-nums text-hc-green font-medium">{s.approved}</td>
                  <td className="p-3 tabular-nums">{s.firstPass}</td>
                  <td className="p-3 tabular-nums">{s.changes}</td>
                  <td className="p-3 tabular-nums">{s.hoursCredited}h</td>
                  <td
                    className={`p-3 tabular-nums ${
                      s.avgSeconds > 0 && s.avgSeconds < 60 ? "text-rose-600 dark:text-rose-400 font-semibold" : ""
                    }`}
                    title={s.avgSeconds > 0 && s.avgSeconds < 60 ? "Under a minute per review — rubber-stamping?" : undefined}
                  >
                    {fmtDur(s.avgSeconds)}
                  </td>
                  <td className="p-3 tabular-nums">
                    <span className={s.repoOpenedPct < 50 ? "text-rose-600 dark:text-rose-400" : ""}>
                      {s.repoOpenedPct}%
                    </span>{" "}
                    /{" "}
                    <span className={s.demoOpenedPct < 50 ? "text-rose-600 dark:text-rose-400" : ""}>
                      {s.demoOpenedPct}%
                    </span>
                  </td>
                  <td className="p-3 text-ink/60">
                    {s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
