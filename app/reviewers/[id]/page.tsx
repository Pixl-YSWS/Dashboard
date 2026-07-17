import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  requireAdmin,
  isSecondPassReviewer,
  ownerSlackIds,
  secondPassSlackIds,
} from "@/lib/guard";
import {
  getAdmin,
  listReviewAudits,
  reviewerStatsBySlackId,
  type ReviewerStats,
} from "@/lib/db";
import { removeReviewer } from "@/app/actions";
import { slackHandle } from "@/lib/slack";

export const dynamic = "force-dynamic";

const EMPTY_STATS: ReviewerStats = {
  reviews: 0,
  approved: 0,
  firstPass: 0,
  needsChanges: 0,
  hoursApproved: 0,
  avgSeconds: 0,
  repoOpenRate: 0,
  lastReview: null,
};

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VERDICT_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: "approved", className: "bg-mint/30 dark:bg-mint/20" },
  first_pass_approved: { label: "first pass", className: "bg-parch" },
  needs_changes: { label: "needs changes", className: "bg-tang/20 text-tang" },
  reverted: { label: "reverted", className: "bg-brand/15 text-brand" },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixl-card p-4">
      <div className="text-xl font-semibold tabular-nums leading-tight">{value}</div>
      <div className="text-xs text-ink/50 mt-1">{label}</div>
    </div>
  );
}

export default async function ReviewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const { id } = await params;
  const slackId = decodeURIComponent(id);

  const admin = await getAdmin(slackId);
  const inTable = !!admin?.permissions.includes("review");
  const fromEnv =
    ownerSlackIds().includes(slackId) || secondPassSlackIds().includes(slackId);
  if (!inTable && !fromEnv) notFound();

  const [stats, audits, handle] = await Promise.all([
    reviewerStatsBySlackId(),
    listReviewAudits(100, slackId),
    slackHandle(slackId),
  ]);
  const s = stats.get(slackId) ?? EMPTY_STATS;
  const display = admin?.name || handle || slackId;
  const isOwner = ownerSlackIds().includes(slackId);
  const initials =
    display
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/reviewers" className="text-sm text-ink/50 hover:text-brand">
          ← Reviewers
        </Link>
      </div>

      <div className="pixl-card p-5 md:p-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-brand/10 text-brand text-lg font-semibold shrink-0">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="text-xl font-semibold flex items-center gap-2 flex-wrap">
              {display}
              {isOwner && (
                <span className="badge bg-brand/15 text-brand text-[0.65rem] uppercase tracking-wide">
                  owner
                </span>
              )}
              {isSecondPassReviewer(slackId) && (
                <span className="badge bg-mint/30 dark:bg-mint/20 text-[0.65rem] uppercase tracking-wide">
                  second pass
                </span>
              )}
            </div>
            <div className="text-sm text-ink/50 font-mono truncate">
              {handle ?? slackId} · {slackId}
            </div>
            <div className="text-xs text-ink/45 mt-0.5">
              {admin?.added_by ? `added by ${admin.added_by} · ` : ""}
              last review {fmtDate(s.lastReview)}
            </div>
          </div>
        </div>
        {inTable ? (
          <form action={removeReviewer} className="shrink-0">
            <input type="hidden" name="slackId" value={slackId} />
            <button className="pixl-btn bg-transparent text-rose-600 border-rose-200 dark:border-rose-500/30 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10">
              Remove reviewer
            </button>
          </form>
        ) : (
          <span className="text-xs text-ink/40 shrink-0" title="Managed via env vars">
            managed via env vars
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="reviews all-time" value={String(s.reviews)} />
        <Stat label="final approvals" value={String(s.approved)} />
        <Stat label="first passes" value={String(s.firstPass)} />
        <Stat label="needs changes" value={String(s.needsChanges)} />
        <Stat label="hours credited" value={String(Math.round(s.hoursApproved * 10) / 10)} />
        <Stat label="avg review time" value={fmtDuration(s.avgSeconds)} />
        <Stat label="repo opened" value={`${Math.round(s.repoOpenRate * 100)}%`} />
        <Stat label="last review" value={fmtDate(s.lastReview)} />
      </div>

      <div>
        <div className="text-sm font-medium text-ink/60 mb-3">
          Review history{audits.length === 100 ? " (last 100)" : ""}
        </div>
        <div className="pixl-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--line)] bg-parch">
                <th className="p-3">Project</th>
                <th className="p-3">Player</th>
                <th className="p-3">Verdict</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Time spent</th>
                <th className="p-3">Checked</th>
                <th className="p-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {audits.map((a) => {
                const badge = VERDICT_BADGE[a.verdict] ?? {
                  label: a.verdict,
                  className: "bg-parch",
                };
                return (
                  <tr key={a.id} className="hover:bg-cream align-top">
                    <td className="p-3">
                      <Link
                        href={`/projects/${a.project_id}`}
                        className="font-bold hover:text-brand"
                      >
                        {a.project_name}
                      </Link>
                      {a.note && (
                        <div className="text-xs text-ink/50 max-w-72 truncate" title={a.note}>
                          {a.note}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Link href={`/players/${a.user_id}`} className="hover:text-brand">
                        {a.player_name}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="p-3 tabular-nums whitespace-nowrap">
                      {a.claimed_hours}
                      {a.approved_hours != null ? ` → ${a.approved_hours}` : ""}
                    </td>
                    <td className="p-3 tabular-nums">{fmtDuration(a.total_seconds)}</td>
                    <td className="p-3 text-xs text-ink/60 whitespace-nowrap">
                      {[a.repo_opened ? "repo" : null, a.demo_opened ? "demo" : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="p-3 text-ink/60 whitespace-nowrap">
                      {fmtDateTime(a.created_at)}
                    </td>
                  </tr>
                );
              })}
              {audits.length === 0 && (
                <tr>
                  <td className="p-5 text-ink/50" colSpan={7}>
                    No reviews yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
