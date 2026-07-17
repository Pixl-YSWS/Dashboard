import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { fetchOnlinePlayers, gameServerConfigured } from "@/lib/gameServer";
import { kickPlayer } from "@/app/actions";

export const dynamic = "force-dynamic";

function sceneLabel(scene: string): string {
  if (scene.startsWith("village")) return "village";
  if (scene.startsWith("lobby:")) return `lobby ${scene.slice(6)}`;
  return scene.replaceAll("_", " ");
}

export default async function OnlinePage() {
  const access = await requirePagePerm(["warn", "ban"]);
  const canKick = access.perms.has("ban");
  const players = await fetchOnlinePlayers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Online now</h1>
        <p className="text-sm text-ink/55 mt-1">
          Live view from the game server. Kicking disconnects the player immediately; they can
          reconnect unless you ban them.
        </p>
      </div>

      {players === null ? (
        <div className="pixl-card p-8 text-center text-ink/55 text-sm">
          {gameServerConfigured()
            ? "Couldn't reach the game server. It might be restarting — try again in a minute."
            : "Not configured — set PIXL_SERVER_URL and ADMIN_API_KEY in the dashboard env."}
        </div>
      ) : players.length === 0 ? (
        <div className="pixl-card p-8 text-center text-ink/55 text-sm">
          Nobody's online right now.
        </div>
      ) : (
        <div className="pixl-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[var(--line)] bg-parch">
                <th className="p-3">Player</th>
                <th className="p-3">Where</th>
                {canKick && <th className="p-3">Kick</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {players.map((p) => (
                <tr key={p.userId} className="hover:bg-cream">
                  <td className="p-3">
                    <Link href={`/players/${p.userId}`} className="font-bold hover:text-brand">
                      {p.displayName || "Player"}
                    </Link>
                    <div className="text-xs text-ink/50 font-mono">{p.userId}</div>
                  </td>
                  <td className="p-3">
                    <span className="badge bg-mint/30 dark:bg-mint/20">{sceneLabel(p.scene)}</span>
                  </td>
                  {canKick && (
                    <td className="p-3">
                      <form action={kickPlayer} className="flex gap-2 items-center flex-wrap">
                        <input type="hidden" name="userId" value={p.userId} />
                        <input
                          name="reason"
                          maxLength={100}
                          placeholder="Reason (optional)"
                          className="pixl-input text-sm w-44"
                        />
                        <button className="pixl-btn bg-tang text-ink text-sm">Kick</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-ink/45">
        {players !== null &&
          `${players.length} player${players.length === 1 ? "" : "s"} online · refresh the page to update`}
      </div>
    </div>
  );
}
