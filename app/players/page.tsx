import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listPlayers } from "@/lib/db";
import { slackHandles } from "@/lib/slack";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePagePerm(["warn", "ban"]);
  const { q } = await searchParams;
  const players = await listPlayers(q);
  const handles = await slackHandles(players.map((p) => p.slack_id));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-6">Players</h1>
      <form className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search display names…"
          className="pixl-input flex-1 min-w-0 max-w-72"
        />
        <button className="pixl-btn bg-ink dark:bg-gray-700 text-white">Search</button>
      </form>
      <div className="pixl-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--line)] bg-parch">
              <th className="p-3">Player</th>
              <th className="p-3">Projects</th>
              <th className="p-3">Violations</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-cream">
                <td className="p-3">
                  <Link href={`/players/${p.id}`} className="font-bold hover:text-brand">
                    {(p.slack_id && handles.get(p.slack_id)) ?? p.slack_id ?? "no slack id"}
                  </Link>
                  <div className="text-xs text-ink/50">
                    {p.display_name} · {p.oauth_provider}
                  </div>
                </td>
                <td className="p-3">{p.projectCount}</td>
                <td className={`p-3 ${p.violationCount > 0 ? "text-tang font-bold" : ""}`}>
                  {p.violationCount}
                </td>
                <td className="p-3">
                  {p.activeBan ? (
                    <span className="badge bg-brand text-white">
                      banned
                    </span>
                  ) : (
                    <span className="badge bg-mint/30 dark:bg-mint/20">
                      ok
                    </span>
                  )}
                </td>
                <td className="p-3 text-ink/60">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td className="p-5 text-ink/50" colSpan={5}>
                  No players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
