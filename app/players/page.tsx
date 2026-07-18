import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listPlayers } from "@/lib/db";
import { slackHandles } from "@/lib/slack";
import { massPlayerAction } from "@/app/actions";
import { SelectAllBox } from "@/app/_components/MassSelect";

export const dynamic = "force-dynamic";

const PER = 25;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; done?: string; error?: string }>;
}) {
  const access = await requirePagePerm(["warn", "ban"]);
  const { q, page, done, error } = await searchParams;
  const all = await listPlayers(q);

  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const players = all.slice(start, start + PER);
  const handles = await slackHandles(players.map((p) => p.slack_id));
  const qp = (n: number) =>
    `/players?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  const canWarn = access.perms.has("warn");
  const canNotify = access.perms.has("notify");
  const canBan = access.perms.has("ban");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-6">Players</h1>

      {done && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 p-3 text-sm font-medium">
          {done}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 p-3 text-sm font-medium">
          {error}
        </div>
      )}

      <form className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search display names…"
          className="pixl-input flex-1 min-w-0 max-w-72"
        />
        <button className="pixl-btn bg-ink dark:bg-gray-700 text-white">Search</button>
      </form>

      <form action={massPlayerAction}>
        <input type="hidden" name="back" value={qp(cur)} />

        <div className="pixl-card p-4 mb-4">
          <div className="text-sm font-semibold mb-3">
            Mass action — tick players below, then apply to all of them at once
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-ink/60 mb-1">Action</span>
              <select name="massAction" className="pixl-input text-sm">
                {canWarn && <option value="warn">Warn</option>}
                {canNotify && <option value="notify">Notify</option>}
                {canBan && <option value="ban">Ban</option>}
                {canBan && <option value="unban">Lift bans</option>}
              </select>
            </label>
            <label className="block flex-1 min-w-56">
              <span className="block text-xs font-medium text-ink/60 mb-1">
                Message / reason (required for ban &amp; notify)
              </span>
              <input
                name="message"
                maxLength={1000}
                placeholder="Sent to every selected player"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block w-44">
              <span className="block text-xs font-medium text-ink/60 mb-1">Title (notify only)</span>
              <input
                name="title"
                maxLength={100}
                placeholder="Message from the Pixl team"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block w-32">
              <span className="block text-xs font-medium text-ink/60 mb-1">Ban hours (blank = permanent)</span>
              <input
                name="hours"
                type="number"
                min={0}
                placeholder="∞"
                className="pixl-input w-full text-sm"
              />
            </label>
            <button className="pixl-btn bg-brand text-white border-transparent text-sm">
              Apply to selected
            </button>
          </div>
        </div>

        <div className="pixl-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--line)] bg-parch">
                <th className="p-3 w-8">
                  <SelectAllBox />
                </th>
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
                    <input
                      type="checkbox"
                      name="userIds"
                      value={p.id}
                      aria-label={`Select ${p.display_name ?? p.id}`}
                      className="w-4 h-4 align-middle"
                    />
                  </td>
                  <td className="p-3">
                    <Link href={`/players/${p.id}`} className="font-bold hover:text-brand">
                      {(p.slack_id && handles.get(p.slack_id)) ?? p.display_name ?? "Unknown"}
                    </Link>
                    <div className="text-xs text-ink/50">
                      {p.slack_id ?? "no slack id"} · {p.oauth_provider}
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
                  <td className="p-5 text-ink/50" colSpan={6}>
                    No players found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
          <span className="text-ink/50">
            Showing {start + 1}–{Math.min(start + PER, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={qp(cur - 1)}
              className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
                cur <= 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              ←
            </Link>
            <span className="text-ink/60 tabular-nums px-1">
              {cur} / {pages}
            </span>
            <Link
              href={qp(cur + 1)}
              className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
                cur >= pages ? "pointer-events-none opacity-40" : ""
              }`}
            >
              →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
