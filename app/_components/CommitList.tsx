"use client";

import { useState } from "react";
import type { CommitResult } from "@/lib/github";

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

  return (
    <div>
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
            <span className="text-xs text-ink/50 shrink-0 hidden sm:inline">{c.author}</span>
            <span className="text-xs text-ink/40 shrink-0">
              {c.date ? new Date(c.date).toLocaleDateString() : ""}
            </span>
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
