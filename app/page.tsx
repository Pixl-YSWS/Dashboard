import Link from "next/link";
import { requireAdmin, canView } from "@/lib/guard";
import { getStats, getGrowthSeries, listViolations } from "@/lib/db";
import { GrowthChart } from "@/app/_components/GrowthChart";
import { Badge } from "@/app/_components/ProjectBadges";

export const dynamic = "force-dynamic";

const RANGES = [14, 30, 60, 90];

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const access = await requireAdmin();
  const showModeration = canView(access, ["warn", "ban"]);
  const { range } = await searchParams;
  const days = RANGES.includes(Number(range)) ? Number(range) : 30;
  const [stats, growth, recent] = await Promise.all([
    getStats(),
    getGrowthSeries(days),
    showModeration ? listViolations(8) : Promise.resolve([]),
  ]);

  const cards = [
    { label: "Players", value: stats.players, delta: stats.playersWeek, accent: false },
    { label: "Projects", value: stats.projects, delta: stats.projectsWeek, accent: false },
    ...(showModeration
      ? [
          { label: "Violations · 7d", value: stats.violations7d, delta: null, accent: false },
          { label: "Active bans", value: stats.activeBans, delta: null, accent: true },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="pixl-card p-5">
            <div className="text-sm font-medium text-ink/55">{c.label}</div>
            <div className="flex items-end gap-2 mt-2">
              <div
                className={`text-3xl font-semibold tabular-nums ${
                  c.accent ? "text-brand" : "text-ink"
                }`}
              >
                {c.value.toLocaleString()}
              </div>
              {c.delta !== null && c.delta > 0 && (
                <span className="mb-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  ▲ {c.delta} / wk
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-ink tracking-tight mb-3">New players</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Today", value: stats.playersToday },
            { label: "This week", value: stats.playersWeek },
            { label: "This month", value: stats.playersMonth },
          ].map((c) => (
            <div key={c.label} className="pixl-card p-5">
              <div className="text-sm font-medium text-ink/55">{c.label}</div>
              <div className="text-3xl font-semibold text-ink tabular-nums mt-2">
                +{c.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-lg font-semibold text-ink tracking-tight">Growth</h3>
          <div className="inline-flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface)]">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={r === 30 ? "/" : `/?range=${r}`}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  r === days
                    ? "bg-ink text-white"
                    : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {r}d
              </Link>
            ))}
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="pixl-card p-5">
            <GrowthChart title="Players" series="players" kind="cumulative" points={growth.players} />
          </div>
          <div className="pixl-card p-5">
            <GrowthChart title="Projects" series="projects" kind="cumulative" points={growth.projects} />
          </div>
          {showModeration && (
            <div className="pixl-card p-5 lg:col-span-2">
              <GrowthChart title="Violations" series="violations" kind="daily" points={growth.violations} />
            </div>
          )}
        </div>
      </div>

      {showModeration && (
        <div>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h3 className="text-lg font-semibold text-ink tracking-tight">Latest violations</h3>
            <Link href="/violations" className="text-brand font-medium text-sm hover:underline">
              See all →
            </Link>
          </div>
          <div className="pixl-card divide-y divide-[var(--line)]">
            {recent.length === 0 && (
              <div className="p-5 text-ink/50 text-sm">Nothing yet — squeaky clean.</div>
            )}
            {recent.map((v) => (
              <div key={v.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Badge tone={v.kind === "chat" ? "amber" : "rose"}>{v.kind}</Badge>
                <div className="flex-1 min-w-0">
                  <Link href={`/players/${v.user_id}`} className="font-medium hover:text-brand">
                    {v.users?.display_name ?? v.user_id}
                  </Link>
                  <div className="text-sm text-ink/60 truncate">“{v.content}”</div>
                </div>
                <div className="text-xs text-ink/45 shrink-0">
                  {new Date(v.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
