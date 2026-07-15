import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listShippedProjects } from "@/lib/db";
import { slackHandles } from "@/lib/slack";
import { ReviewTabs } from "@/app/_components/ReviewTabs";
import { ReviewTable } from "@/app/_components/ReviewTable";

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
        <div className="text-sm text-ink/50">
          Showing <span className="font-semibold text-ink/70">{total}</span> of {total}
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
    </div>
  );
}
