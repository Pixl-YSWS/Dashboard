import Link from "next/link";
import { requireAdmin, canView } from "@/lib/guard";
import { getStats, getGrowthSeries, listViolations } from "@/lib/db";
import { GrowthChart } from "@/app/_components/GrowthChart";

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
    { label: "Players", value: stats.players, color: "text-ink", delta: stats.playersWeek },
    { label: "Projects", value: stats.projects, color: "text-ink", delta: stats.projectsWeek },
    ...(showModeration
      ? [
          { label: "Violations (7d)", value: stats.violations7d, color: "text-tang", delta: null },
          { label: "Active bans", value: stats.activeBans, color: "text-brand", delta: null },
        ]
      : []),
  ];

  return (
    <div>
      <h1 className="font-pixel text-4xl md:text-5xl text-brand mb-6">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="pixl-card p-4 md:p-5">
            <div className={`text-4xl md:text-5xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-sm font-bold text-ink/60 mt-1">
              {c.label}
              {c.delta !== null && c.delta > 0 && (
                <span className="text-green-600 dark:text-green-400 ml-2">
                  +{c.delta} this week
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="font-pixel text-2xl md:text-3xl text-ink mr-3">Growth</h2>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={r === 30 ? "/" : `/?range=${r}`}
            className={`text-xs font-bold px-2.5 py-1 border-2 ${
              r === days
                ? "border-ink bg-ink text-white dark:bg-gray-700"
                : "border-ink/20 text-ink/60 hover:border-ink hover:text-ink"
            }`}
          >
            {r}d
          </Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5 mb-10">
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

      {showModeration && (
        <>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-pixel text-2xl md:text-3xl text-ink">Latest violations</h2>
            <Link href="/violations" className="text-brand font-bold text-sm underline">
              see all →
            </Link>
          </div>
          <div className="pixl-card divide-y-2 divide-ink/10">
            {recent.length === 0 && (
              <div className="p-5 text-ink/50 text-sm">Nothing yet — squeaky clean.</div>
            )}
            {recent.map((v) => (
              <div key={v.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span
                  className={`font-pixel text-sm px-2 py-0.5 border-2 border-ink ${
                    v.kind === "chat" ? "bg-tang/20 dark:bg-tang/30" : "bg-brand/15 dark:bg-brand/30"
                  }`}
                >
                  {v.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/players/${v.user_id}`}
                    className="font-bold hover:text-brand"
                  >
                    {v.users?.display_name ?? v.user_id}
                  </Link>
                  <div className="text-sm text-ink/70 truncate">“{v.content}”</div>
                </div>
                <div className="text-xs text-ink/50 shrink-0">
                  {new Date(v.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
