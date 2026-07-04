import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { getStats, listViolations } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Overview() {
  await requireAdmin();
  const [stats, recent] = await Promise.all([getStats(), listViolations(8)]);

  const cards = [
    { label: "Players", value: stats.players, color: "text-ink" },
    { label: "Projects", value: stats.projects, color: "text-ink" },
    { label: "Violations (7d)", value: stats.violations7d, color: "text-tang" },
    { label: "Active bans", value: stats.activeBans, color: "text-brand" },
  ];

  return (
    <div>
      <h1 className="font-pixel text-5xl text-brand mb-6">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="pixl-card p-5">
            <div className={`text-5xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-sm font-bold text-ink/60 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-pixel text-3xl text-ink">Latest violations</h2>
        <Link href="/violations" className="text-brand font-bold text-sm underline">
          see all →
        </Link>
      </div>
      <div className="pixl-card divide-y-2 divide-ink/10">
        {recent.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">Nothing yet — squeaky clean.</div>
        )}
        {recent.map((v) => (
          <div key={v.id} className="p-4 flex items-center gap-4">
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
    </div>
  );
}
