import type { HackatimeReport, HackatimeBreakdown } from "@/lib/hackatime";

function fmtDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function Breakdown({ title, items }: { title: string; items: HackatimeBreakdown[] }) {
  const top = items.filter((i) => i.seconds > 0).slice(0, 10);
  if (top.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/45 mb-2">{title}</div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-black/[0.06] dark:bg-white/[0.08] mb-2">
        {top.map((i, n) => (
          <div
            key={n}
            className="h-full"
            style={{ width: `${i.percent}%`, background: i.color || "var(--brand)" }}
            title={`${i.name} · ${i.text} · ${i.percent}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {top.map((i, n) => (
          <div key={n} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.color || "var(--brand)" }} />
            <span className="text-ink/75">{i.name}</span>
            <span className="text-ink/45 tabular-nums">{i.text}</span>
            <span className="text-ink/35 tabular-nums">{i.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HackatimePanel({ report }: { report: HackatimeReport }) {
  const linked = report.projects.filter((p) => p.linked);
  const others = report.projects.filter((p) => !p.linked).slice(0, 8);
  const maxSecs = Math.max(1, ...report.projects.map((p) => p.seconds));

  const ProjectRow = (p: HackatimeReport["projects"][number]) => (
    <div key={p.name} className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-medium text-sm">{p.name}</span>
        {p.linked && (
          <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            linked
          </span>
        )}
        <span className="badge bg-black/[0.05] text-ink/70 dark:bg-white/[0.08]">{p.text}</span>
        <span className="text-xs text-ink/45 ml-auto tabular-nums">{p.percent}% of all-time</span>
      </div>
      <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden mb-2">
        <div className="h-full bg-[color:var(--color-hc-blue)]" style={{ width: `${(p.seconds / maxSecs) * 100}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/55">
        <span>{p.sessions > 0 ? `${p.sessions} coding session${p.sessions === 1 ? "" : "s"}` : "no session data"}</span>
        {p.firstActivity && <span>first activity {fmtDate(p.firstActivity)}</span>}
        {p.lastActivity && <span>last activity {fmtDate(p.lastActivity)}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b border-[var(--line)]">
        <Tile label="Total coded (all projects)" value={report.humanReadableTotal || fmtSecs(report.totalSeconds)} />
        <Tile label="Daily average" value={fmtSecs(report.dailyAverageSeconds)} />
        <Tile
          label="Tracked since"
          value={report.rangeStart ? new Date(report.rangeStart).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"}
        />
      </div>

      <div className="p-4 space-y-4 border-b border-[var(--line)]">
        {report.languages.length > 0 && <Breakdown title="Languages (all projects)" items={report.languages} />}
        {report.editors.length > 0 && <Breakdown title="Editors" items={report.editors} />}
        {report.operatingSystems.length > 0 && <Breakdown title="Operating systems" items={report.operatingSystems} />}
        {report.machines.length > 0 && <Breakdown title="Machines" items={report.machines} />}
        {report.languages.length === 0 && (
          <div className="text-sm text-ink/45">No language breakdown available for this maker.</div>
        )}
      </div>

      <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-ink/45">
        Projects linked to this submission
      </div>
      <div className="divide-y divide-[var(--line)]">
        {linked.length > 0 ? (
          linked.map(ProjectRow)
        ) : (
          <div className="p-4 text-sm text-ink/45">No linked Hackatime projects.</div>
        )}
      </div>

      {others.length > 0 && (
        <details className="border-t border-[var(--line)]">
          <summary className="p-4 text-sm text-ink/55 cursor-pointer select-none hover:text-ink">
            This maker&apos;s other Hackatime projects ({report.projects.length - linked.length})
          </summary>
          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">{others.map(ProjectRow)}</div>
        </details>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="pixl-card p-3">
      <div className="text-lg font-bold tabular-nums break-words">{value}</div>
      <div className="text-[0.7rem] text-ink/45 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}
