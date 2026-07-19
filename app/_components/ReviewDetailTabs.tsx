"use client";

import { useEffect, useState } from "react";
import type { CommitResult } from "@/lib/github";
import type { HackatimeReport } from "@/lib/hackatime";
import type { JournalRow, ModActionRow } from "@/lib/db";
import type { YswsShip } from "@/lib/ysws";
import { CommitList } from "@/app/_components/CommitList";
import { renderMarkdown } from "@/lib/markdown";
import { DeflateInput } from "@/app/_components/DeflateInput";
import { HackatimePanel } from "@/app/_components/HackatimePanel";

const VERDICT_LABEL: Record<string, { label: string; cls: string }> = {
  project_approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  project_needs_changes: { label: "Needs changes", cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  review_reverted: { label: "Reverted", cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
};

export function ReviewDetailTabs({
  commits,
  journals,
  verdicts,
  yswsShips,
  hackatime,
}: {
  commits: CommitResult;
  journals: JournalRow[];
  verdicts: ModActionRow[];
  yswsShips: YswsShip[];
  hackatime: HackatimeReport | null;
}) {
  const [tab, setTab] = useState<"commits" | "journals" | "reviews" | "ysws" | "hackatime">("commits");

  useEffect(() => {
    const open = () => {
      if (location.hash === "#hackatime" && hackatime) setTab("hackatime");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [hackatime]);

  const tabs = [
    { key: "commits" as const, label: "Commits", count: commits.commits.length },
    { key: "journals" as const, label: "Journals", count: journals.length },
    ...(hackatime?.ok ? [{ key: "hackatime" as const, label: "Hackatime", count: hackatime.projects.length }] : []),
    { key: "reviews" as const, label: "Past reviews", count: verdicts.length },
    { key: "ysws" as const, label: "Other YSWS", count: yswsShips.filter((s) => s.urlMatch).length },
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

      {tab === "hackatime" && hackatime && <HackatimePanel report={hackatime} />}

      {tab === "journals" && (
        <div className="divide-y divide-[var(--line)]">
          {journals.length === 0 && (
            <div className="p-5 text-sm text-ink/50">No journal entries.</div>
          )}
          {journals.map((j) => (
            <div key={j.id} className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <span className="badge bg-black/[0.05] text-ink/70 dark:bg-white/[0.08]">
                  {Math.round((Number(j.hours) || 0) * 10) / 10}h
                </span>
                {Number(j.hours) > 0 && (
                  <DeflateInput itemKey={`j:${j.id}`} maxMinutes={Math.round((Number(j.hours) || 0) * 60)} />
                )}
                <span className="text-xs text-ink/45 ml-auto">
                  {new Date(j.created_at).toLocaleString()}
                </span>
              </div>
              <div
                className="md text-sm break-words text-ink/80"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(j.content) }}
              />
            </div>
          ))}
        </div>
      )}

      {tab === "ysws" && (() => {
        const matches = yswsShips.filter((s) => s.urlMatch);
        const Row = (s: YswsShip, i: number) => (
          <div key={i} className="p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-sm">{s.ysws}</span>
              {s.urlMatch && (
                <span className="badge bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  same repo/demo as this submission
                </span>
              )}
              <span className="badge bg-black/[0.05] text-ink/70 dark:bg-white/[0.08]">{s.hours}h</span>
              <span className="text-xs text-ink/45 ml-auto">
                {s.approvedAt ? `approved ${new Date(s.approvedAt).toLocaleDateString()}` : "no date"}
              </span>
            </div>
            {s.description && (
              <div className="text-sm text-ink/70 break-words mb-1">{s.description}</div>
            )}
            <div className="flex gap-3 text-xs">
              {s.codeUrl && s.codeUrl !== "null" && (
                <a href={s.codeUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">repo ↗</a>
              )}
              {s.demoUrl && s.demoUrl !== "null" && (
                <a href={s.demoUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">demo ↗</a>
              )}
            </div>
          </div>
        );
        return (
          <div>
            <div className="divide-y divide-[var(--line)]">
              {matches.length === 0 ? (
                <div className="p-5 text-sm text-ink/50">
                  This project&apos;s repo/demo isn&apos;t in the YSWS archive — no sign it was double-dipped.
                </div>
              ) : (
                <>
                  <div className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                    ⚠ This exact project also shipped to another YSWS
                  </div>
                  {matches.map(Row)}
                </>
              )}
            </div>
          </div>
        );
      })()}

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
