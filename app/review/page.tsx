import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listShippedProjects, listSecondReviewProjects, listReviewAudits } from "@/lib/db";
import { slackHandles } from "@/lib/slack";
import { ReviewTabs } from "@/app/_components/ReviewTabs";
import { ReviewTable } from "@/app/_components/ReviewTable";
import { LiveReview } from "@/app/_components/LiveReview";

export const dynamic = "force-dynamic";

const PER = 15;
const SORTS = [
  { key: "oldest", label: "Oldest" },
  { key: "hours", label: "Hours" },
  { key: "status", label: "Status" },
];

export default async function ReviewListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const access = await requirePagePerm(["review"]);
  const viewer = access.session.slackId;
  const { page, sort } = await searchParams;

  const finalRows = access.canSecondPass ? await listSecondReviewProjects(viewer) : [];
  const finalHandles = finalRows.length
    ? await slackHandles(finalRows.map((p) => p.users?.slack_id))
    : new Map<string, string>();

  const myRecent = await listReviewAudits(5, viewer);
  let rows = await listShippedProjects(viewer);
  if (sort === "hours") rows = [...rows].sort((a, b) => b.hours - a.hours);
  else if (sort === "status") rows = [...rows].sort((a, b) => a.status.localeCompare(b.status));

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const slice = rows.slice(start, start + PER);
  const handles = await slackHandles(slice.map((p) => p.users?.slack_id));
  const sortKey = SORTS.some((s) => s.key === sort) ? sort : "oldest";
  const qp = (p: number) => `/review?page=${p}${sortKey !== "oldest" ? `&sort=${sortKey}` : ""}`;

  return (
    <div>
      <ReviewTabs isSuper={access.isSuper} pending={total} />

      {finalRows.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <h2 className="text-sm font-semibold text-ink">
              Awaiting your final pass
              <span className="ml-2 badge bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                {finalRows.length}
              </span>
            </h2>
          </div>
          <p className="text-xs text-ink/55 mb-3">
            These passed a first review. Your approval credits pixels and ships them.
          </p>
          <ReviewTable
            rows={finalRows}
            handles={finalHandles}
            emptyLabel="Nothing waiting on a final pass."
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="inline-flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface)]">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={`/review${s.key !== "oldest" ? `?sort=${s.key}` : ""}`}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                sortKey === s.key
                  ? "bg-ink text-white"
                  : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LiveReview />
          <div className="text-sm text-ink/50">
            Showing <span className="font-semibold text-ink/70">{total}</span> of {total}
          </div>
        </div>
      </div>

      <ReviewTable
        rows={slice}
        handles={handles}
        emptyLabel="Queue's clear. Nothing waiting for review."
      />

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

      {myRecent.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-ink/60 mb-3">Recently reviewed by you</h3>
          <div className="pixl-card divide-y divide-[var(--line)]">
            {myRecent.map((a) => (
              <Link
                key={a.id}
                href={`/projects/${a.project_id}`}
                className="p-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <span className="font-medium text-sm">{a.project_name}</span>
                <span className="text-xs text-ink/55">
                  {a.verdict.replaceAll("_", " ")} · {a.player_name}
                </span>
                <span className="text-xs text-ink/45 ml-auto shrink-0">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
