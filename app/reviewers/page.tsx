import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireAdmin,
  isSecondPassReviewer,
  ownerSlackIds,
  secondPassSlackIds,
  NO_REVIEW,
} from "@/lib/guard";
import {
  listAdmins,
  reviewerStatsBySlackId,
  displayNamesBySlackId,
  payoutTotalsBySlackId,
  type ReviewerStats,
} from "@/lib/db";
import { addReviewer } from "@/app/actions";
import { slackHandles } from "@/lib/slack";
import { TeamLog } from "@/app/_components/TeamLog";

export const dynamic = "force-dynamic";

const PER = 15;

const EMPTY_STATS: ReviewerStats = {
  reviews: 0,
  approved: 0,
  firstPass: 0,
  needsChanges: 0,
  hoursApproved: 0,
  avgSeconds: 0,
  repoOpenRate: 0,
  flagged: 0,
  lastReview: null,
};

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 text-center">
      <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
      <div className="text-[0.7rem] text-ink/50 mt-0.5 whitespace-nowrap">{label}</div>
    </div>
  );
}

export default async function ReviewersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const { q, page } = await searchParams;

  const [admins, stats, payoutTotals] = await Promise.all([
    listAdmins(),
    reviewerStatsBySlackId(),
    payoutTotalsBySlackId(),
  ]);
  const tableReviewers = admins.filter((a) => a.permissions.includes("review"));
  const inTable = new Set(tableReviewers.map((r) => r.slack_id));
  const blocked = new Set(
    admins.filter((a) => a.permissions.includes(NO_REVIEW)).map((a) => a.slack_id),
  );
  const owners = new Set(ownerSlackIds());
  const envOnly = [...new Set([...ownerSlackIds(), ...secondPassSlackIds()])].filter(
    (id) => !inTable.has(id) && !blocked.has(id),
  );
  const allReviewers = [
    ...envOnly.map((id) => ({ slack_id: id, name: "" })),
    ...tableReviewers.map((r) => ({ slack_id: r.slack_id, name: r.name })),
  ];
  const ids = allReviewers.map((r) => r.slack_id);
  const [handles, playerNames] = await Promise.all([
    slackHandles(ids),
    displayNamesBySlackId(ids),
  ]);
  const displayFor = (r: { slack_id: string; name: string }) =>
    r.name || handles.get(r.slack_id) || playerNames.get(r.slack_id) || r.slack_id;

  const needle = (q ?? "").trim().toLowerCase();
  const filtered = needle
    ? allReviewers.filter((r) => {
        const handle = handles.get(r.slack_id) ?? "";
        return (
          displayFor(r).toLowerCase().includes(needle) ||
          r.slack_id.toLowerCase().includes(needle) ||
          handle.toLowerCase().includes(needle)
        );
      })
    : allReviewers;

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const reviewers = filtered.slice(start, start + PER);
  const qp = (n: number) =>
    `/reviewers?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink tracking-tight">Reviewers</h1>
          <p className="text-sm text-ink/55 mt-1 max-w-2xl">
            Everyone who can work the ship queue. Click a reviewer for their full stats and
            review history.
          </p>
        </div>
        <div className="pixl-card flex divide-x divide-[var(--line)]">
          <StatCell label="reviews all-time" value={String(totals.reviews)} />
          <StatCell label="final approvals" value={String(totals.approved)} />
          <StatCell
            label="hours credited"
            value={String(Math.round(totals.hours * 10) / 10)}
          />
        </div>
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
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="text-sm font-medium text-ink/60">
            {total} reviewer{total === 1 ? "" : "s"}
            {needle ? ` matching “${q}”` : ""}
          </div>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search reviewers…"
              className="pixl-input text-sm w-56"
            />
            <button className="pixl-btn bg-ink dark:bg-gray-700 text-white text-sm">Search</button>
          </form>
        </div>

        <div className="pixl-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--line)] bg-parch">
                <th className="p-3">Reviewer</th>
                <th className="p-3">Reviews</th>
                <th className="p-3">Approved</th>
                <th className="p-3">Hours credited</th>
                <th className="p-3">Earned</th>
                <th className="p-3">Flags</th>
                <th className="p-3">Last review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {reviewers.map((r) => {
                const handle = (r.slack_id && handles.get(r.slack_id)) ?? r.slack_id;
                const s = stats.get(r.slack_id) ?? EMPTY_STATS;
                return (
                  <tr key={r.slack_id} className="hover:bg-cream">
                    <td className="p-3">
                      <Link
                        href={`/reviewers/${r.slack_id}`}
                        className="font-bold hover:text-brand"
                      >
                        {displayFor(r)}
                      </Link>
                      <span className="inline-flex gap-1 ml-2 align-middle">
                        {owners.has(r.slack_id) && (
                          <span className="badge bg-brand/15 text-brand text-[0.65rem] uppercase tracking-wide">
                            admin
                          </span>
                        )}
                        {isSecondPassReviewer(r.slack_id) && (
                          <span className="badge bg-mint/30 dark:bg-mint/20 text-[0.65rem] uppercase tracking-wide">
                            second pass
                          </span>
                        )}
                      </span>
                      <div className="text-xs text-ink/50 font-mono">{handle}</div>
                    </td>
                    <td className="p-3 tabular-nums">{s.reviews}</td>
                    <td className="p-3 tabular-nums">{s.approved}</td>
                    <td className="p-3 tabular-nums">
                      {Math.round(s.hoursApproved * 10) / 10}
                    </td>
                    <td className="p-3 tabular-nums whitespace-nowrap">
                      {(() => {
                        const t = payoutTotals.get(r.slack_id);
                        if (!t) return "—";
                        return (
                          <>
                            {t.earnedPixels} px
                            {t.pending > 0 && (
                              <span className="text-xs text-ink/50"> · {t.pending} pending</span>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td
                      className={`p-3 tabular-nums ${
                        s.flagged > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : ""
                      }`}
                    >
                      {s.flagged}
                    </td>
                    <td className="p-3 text-ink/60">{fmtDate(s.lastReview)}</td>
                  </tr>
                );
              })}
              {reviewers.length === 0 && (
                <tr>
                  <td className="p-5 text-ink/50" colSpan={7}>
                    {needle
                      ? "No reviewers match that search."
                      : "No reviewers yet. Add someone above to start clearing the queue."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between gap-3 mt-4 text-sm">
            <span className="text-ink/50">
              Showing {start + 1}–{Math.min(start + PER, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={qp(cur - 1)}
                className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
                  cur <= 1 ? "pointer-events-none opacity-40" : ""
                }`}
              >
                ←
              </Link>
              <span className="text-ink/60 tabular-nums px-1">
                {cur} / {pages}
              </span>
              <Link
                href={qp(cur + 1)}
                className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
                  cur >= pages ? "pointer-events-none opacity-40" : ""
                }`}
              >
                →
              </Link>
            </div>
          </div>
        )}
      </div>

      <TeamLog />
    </div>
  );
}
