"use client";

import { useState } from "react";
import type { CommitResult } from "@/lib/github";
import { DeflateInput } from "@/app/_components/DeflateInput";

const PER_PAGE = 8;

export function CommitList({ result }: { result: CommitResult }) {
  const [page, setPage] = useState(0);

  if (result.error === "not_github")
    return <div className="p-4 text-ink/50 text-sm">Repo link isn&apos;t a GitHub URL.</div>;
  if (result.error === "not_found")
    return (
      <div className="p-4 text-brand text-sm font-medium">
        {result.repo} — repo not found or private (404).
      </div>
    );
  if (result.error)
    return (
      <div className="p-4 text-ink/50 text-sm">
        Couldn&apos;t load commits ({result.error}).
      </div>
    );
  if (result.commits.length === 0)
    return <div className="p-4 text-ink/50 text-sm">No commits.</div>;

  const total = result.commits.length;
  const pages = Math.ceil(total / PER_PAGE);
  const start = page * PER_PAGE;
  const shown = result.commits.slice(start, start + PER_PAGE);
  const hasTracking = result.commits.some((c) => c.tracked !== undefined);

  const gaps = new Map<string, number>();
  const asc = result.commits
    .filter((c) => c.date)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < asc.length; i++) {
    const s =
      (new Date(asc[i].date).getTime() - new Date(asc[i - 1].date).getTime()) / 1000;
    if (Number.isFinite(s) && s >= 0) gaps.set(asc[i].sha, s);
  }
  const fmtGap = (s: number) => {
    if (s < 60) return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${Math.round(s / 3600)}h`;
    return `${Math.round(s / 86400)}d`;
  };

  const trackedBadge = (secs?: number) => {
    if (secs === undefined) return null;
    if (secs < 120)
      return (
        <span
          className="badge bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 shrink-0"
          title="Almost no tracked coding time between this commit and the previous one — code appeared without coding."
        >
          ~0m coded
        </span>
      );
    const h = secs / 3600;
    return (
      <span
        className="badge bg-black/[0.05] text-ink/70 dark:bg-white/[0.08] shrink-0"
        title="Hackatime coding time between this commit and the previous one"
      >
        {h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(secs / 60)}m`} coded
      </span>
    );
  };

  return (
    <div>
      {hasTracking && (
        <div className="px-3 py-2 text-xs text-ink/50 border-b border-[var(--line)]">
          &ldquo;coded&rdquo; = Hackatime time between commits.{" "}
          <span className="text-rose-600 dark:text-rose-400">~0m coded</span> means code landed
          with no tracked coding behind it — check for pasted/AI-dumped work.
        </div>
      )}
      <div className="divide-y divide-[var(--line)]">
        {shown.map((c) => (
          <div key={c.sha} className="p-3 flex items-baseline gap-3 text-sm">
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-brand shrink-0 hover:underline"
            >
              {c.sha}
            </a>
            <span className="flex-1 min-w-0 break-words">{c.message}</span>
            {c.ai && (
              <span
                className="badge bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 shrink-0"
                title="This commit is signed by an AI tool (co-author trailer / bot author / generated-with footer). Check the AI-used disclosure."
              >
                AI commit
              </span>
            )}
            {c.additions !== undefined && (
              <span
                className={`text-xs shrink-0 tabular-nums ${
                  c.tracked !== undefined &&
                  c.additions >= 200 &&
                  c.additions / (Math.max(c.tracked, 60) / 3600) > 1500
                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                    : "text-ink/45"
                }`}
                title={
                  c.tracked !== undefined &&
                  c.additions >= 200 &&
                  c.additions / (Math.max(c.tracked, 60) / 3600) > 1500
                    ? "Huge amount of code vs almost no tracked coding time — possible paste/AI dump."
                    : "Lines added / removed"
                }
              >
                +{c.additions} −{c.deletions ?? 0}
              </span>
            )}
            {gaps.has(c.sha) && (
              <span
                className="text-xs text-ink/45 shrink-0 tabular-nums"
                title="Wall-clock time since the previous commit"
              >
                +{fmtGap(gaps.get(c.sha)!)}
              </span>
            )}
            {trackedBadge(c.tracked)}
            <span className="text-xs text-ink/50 shrink-0 hidden sm:inline">{c.author}</span>
            <span className="text-xs text-ink/40 shrink-0">
              {c.date ? new Date(c.date).toLocaleDateString() : ""}
            </span>
            <DeflateInput
              itemKey={`c:${c.sha}`}
              maxMinutes={c.tracked !== undefined ? Math.round(c.tracked / 60) : undefined}
            />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 p-3 border-t border-[var(--line)] text-sm">
          <span className="text-ink/50 tabular-nums">
            {start + 1}–{Math.min(start + PER_PAGE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="pixl-btn bg-[var(--surface)] text-ink text-xs disabled:opacity-40 disabled:pointer-events-none"
            >
              ← Prev
            </button>
            <span className="text-ink/50 tabular-nums">
              {page + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="pixl-btn bg-[var(--surface)] text-ink text-xs disabled:opacity-40 disabled:pointer-events-none"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
