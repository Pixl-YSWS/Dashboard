"use client";

import { useState } from "react";
import type { CommitResult } from "@/lib/github";
import type { JournalRow, ModActionRow } from "@/lib/db";
import { CommitList } from "@/app/_components/CommitList";

const VERDICT_LABEL: Record<string, { label: string; cls: string }> = {
  project_approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  project_needs_changes: { label: "Needs changes", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  review_reverted: { label: "Reverted", cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
};

export function ReviewDetailTabs({
  commits,
  journals,
  verdicts,
}: {
  commits: CommitResult;
  journals: JournalRow[];
  verdicts: ModActionRow[];
}) {
  const [tab, setTab] = useState<"commits" | "journals" | "reviews">("commits");

  const tabs = [
    { key: "commits" as const, label: "Commits", count: commits.commits.length },
    { key: "journals" as const, label: "Journals", count: journals.length },
    { key: "reviews" as const, label: "Past reviews", count: verdicts.length },
  ];

  return (
    <div className="pixl-card overflow-hidden">
      <div className="flex items-center gap-1 px-2 border-b border-[var(--line)]">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-ink/55 hover:text-ink"
              }`}
            >
              {t.label}
              <span
                className={`text-[0.7rem] font-semibold px-1.5 py-0.5 rounded-full ${
                  active ? "bg-brand text-white" : "bg-black/[0.06] dark:bg-white/10 text-ink/60"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "commits" && <CommitList result={commits} />}

      {tab === "journals" && (
        <div className="divide-y divide-[var(--line)]">
          {journals.length === 0 && (
            <div className="p-5 text-sm text-ink/50">No journal entries.</div>
          )}
          {journals.map((j) => (
            <div key={j.id} className="p-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="badge bg-black/[0.05] text-ink/70 dark:bg-white/[0.08]">
                  {Math.round((Number(j.hours) || 0) * 10) / 10}h
                </span>
                <span className="text-xs text-ink/45">
                  {new Date(j.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-sm whitespace-pre-wrap break-words text-ink/80">{j.content}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "reviews" && (
        <div className="divide-y divide-[var(--line)]">
          {verdicts.length === 0 && (
            <div className="p-5 text-sm text-ink/50">No past reviews.</div>
          )}
          {verdicts.map((v) => {
            const meta = VERDICT_LABEL[v.action] ?? {
              label: v.action,
              cls: "bg-black/[0.05] text-ink/70 dark:bg-white/[0.08]",
            };
            return (
              <div key={v.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                <div className="flex-1 min-w-48">
                  <span className="font-medium">{v.actor}</span>
                  <div className="text-ink/70 break-words">{v.detail}</div>
                </div>
                <span className="text-xs text-ink/45">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
