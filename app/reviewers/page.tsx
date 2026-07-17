import { redirect } from "next/navigation";
import { requireAdmin, isSecondPassReviewer } from "@/lib/guard";
import { listAdmins, reviewerStatsBySlackId, type ReviewerStats } from "@/lib/db";
import { addReviewer, removeReviewer } from "@/app/actions";
import { slackHandles } from "@/lib/slack";

export const dynamic = "force-dynamic";

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-2.5">
      <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
      <div className="text-xs text-ink/50 mt-0.5">{label}</div>
    </div>
  );
}

export default async function ReviewersPage() {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");

  const [admins, stats] = await Promise.all([listAdmins(), reviewerStatsBySlackId()]);
  const reviewers = admins.filter((a) => a.permissions.includes("review"));
  const handles = await slackHandles(reviewers.map((r) => r.slack_id));

  const totals = [...stats.values()].reduce(
    (acc, s) => {
      acc.reviews += s.reviews;
      acc.approved += s.approved;
      acc.hours += s.hoursApproved;
      return acc;
    },
    { reviews: 0, approved: 0, hours: 0 },
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Reviewers</h1>
        <p className="text-sm text-ink/55 mt-1 max-w-2xl">
          Reviewers work the ship queue and do first passes. Final approval (and pixel payouts)
          stays with the second-pass reviewers from SECOND_PASS_SLACK_IDS. Owners can always
          review and are not listed here.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <Stat label="reviews all-time" value={String(totals.reviews)} />
        <Stat label="final approvals" value={String(totals.approved)} />
        <Stat label="hours credited" value={String(Math.round(totals.hours * 10) / 10)} />
      </div>

      <div className="pixl-card p-5 md:p-6">
        <div className="text-base font-semibold mb-4">Add a reviewer</div>
        <form action={addReviewer} className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Name</span>
            <input name="name" placeholder="e.g. Alex Rivera" className="pixl-input w-full text-sm" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Slack member ID</span>
            <input
              name="slackId"
              required
              placeholder="U0XXXXXXX"
              className="pixl-input w-full text-sm font-mono"
            />
          </label>
          <button className="pixl-btn bg-brand text-white border-transparent">Add reviewer</button>
        </form>
        <p className="text-xs text-ink/45 mt-2">
          Slack → profile → ⋯ → Copy member ID. If they&apos;re already a sub-admin, this just
          grants them review access on top.
        </p>
      </div>

      <div>
        <div className="text-sm font-medium text-ink/60 mb-3">
          {reviewers.length} reviewer{reviewers.length === 1 ? "" : "s"}
        </div>
        {reviewers.length === 0 ? (
          <div className="pixl-card p-8 text-center text-ink/55 text-sm">
            No reviewers yet. Add someone above to start clearing the queue.
          </div>
        ) : (
          <div className="space-y-4">
            {reviewers.map((r) => {
              const handle = (r.slack_id && handles.get(r.slack_id)) ?? r.slack_id;
              const s: ReviewerStats = stats.get(r.slack_id) ?? {
                reviews: 0,
                approved: 0,
                firstPass: 0,
                needsChanges: 0,
                hoursApproved: 0,
                avgSeconds: 0,
                repoOpenRate: 0,
                lastReview: null,
              };
              const initials =
                (r.name || handle || "?")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?";
              return (
                <div key={r.slack_id} className="pixl-card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-brand/10 text-brand text-sm font-semibold shrink-0">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-2">
                          {r.name || handle}
                          {isSecondPassReviewer(r.slack_id) && (
                            <span className="text-[0.65rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-mint/20 text-emerald-700 dark:text-emerald-400">
                              second pass
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink/50 truncate font-mono">
                          {handle}
                          {r.added_by ? ` · added by ${r.added_by}` : ""} · last review{" "}
                          {fmtDate(s.lastReview)}
                        </div>
                      </div>
                    </div>
                    <form action={removeReviewer}>
                      <input type="hidden" name="slackId" value={r.slack_id} />
                      <button className="pixl-btn bg-transparent text-rose-600 border-rose-200 dark:border-rose-500/30 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        Remove
                      </button>
                    </form>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
                    <Stat label="reviews" value={String(s.reviews)} />
                    <Stat label="approved" value={String(s.approved)} />
                    <Stat label="first passes" value={String(s.firstPass)} />
                    <Stat label="needs changes" value={String(s.needsChanges)} />
                    <Stat label="hours credited" value={String(Math.round(s.hoursApproved * 10) / 10)} />
                    <Stat label="avg review time" value={fmtDuration(s.avgSeconds)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
