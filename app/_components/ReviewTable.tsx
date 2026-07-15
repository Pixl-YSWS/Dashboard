import Link from "next/link";
import type { ShippedProject } from "@/lib/db";
import { LevelBadge, StatusBadge } from "@/app/_components/ProjectBadges";

function fmtHM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function waited(iso: string | null): string {
  if (!iso) return "—";
  const d = Math.max(0, Date.now() - new Date(iso).getTime());
  const days = Math.floor(d / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hrs = Math.floor(d / 3_600_000);
  return `${hrs}h`;
}

function initials(name: string): string {
  return (
    name
      .replace(/^@/, "")
      .split(/[\s_]+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function ReviewTable({
  rows,
  handles,
  emptyLabel = "Nothing here.",
}: {
  rows: ShippedProject[];
  handles: Map<string, string>;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="pixl-card p-10 text-center text-ink/55">{emptyLabel}</div>
    );
  }
  return (
    <div className="pixl-card overflow-hidden">
      <div className="hidden md:grid grid-cols-[1fr_240px_140px_120px] gap-4 px-5 py-3 border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wide text-ink/45">
        <div>Project</div>
        <div>Maker</div>
        <div>Status</div>
        <div className="text-right">Waiting</div>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {rows.map((p) => {
          const maker =
            (p.users?.slack_id && handles.get(p.users.slack_id)) ??
            p.users?.slack_id ??
            p.users?.display_name ??
            p.user_id;
          return (
            <Link
              key={p.id}
              href={`/review/${p.id}`}
              prefetch={false}
              className="grid md:grid-cols-[1fr_240px_140px_120px] gap-x-4 gap-y-2 px-5 py-3.5 items-center hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border border-[var(--line)] shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-ink/40 font-mono">#{p.id}</span>
                    <LevelBadge level={p.level} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 min-w-0">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-brand/15 text-brand text-[0.6rem] font-semibold shrink-0">
                  {initials(String(maker))}
                </span>
                <span className="text-sm truncate text-ink/80">{maker}</span>
              </div>

              <div>
                <StatusBadge status={p.status} />
              </div>

              <div className="md:text-right text-sm">
                <div className="text-ink/70">{waited(p.shipped_at)}</div>
                <div className="text-xs text-ink/45">{fmtHM(p.hours)} logged</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
