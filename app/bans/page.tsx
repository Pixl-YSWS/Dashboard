import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listBans, listBanLog, banIsActive } from "@/lib/db";
import { LiftBanForm } from "@/app/_components/Moderate";

export const dynamic = "force-dynamic";

export default async function BansPage() {
  await requirePagePerm(["warn", "ban"]);
  const [bans, log] = await Promise.all([listBans(), listBanLog()]);

  return (
    <div>
      <h1 className="font-pixel text-4xl md:text-5xl text-brand mb-2">Bans</h1>
      <p className="text-sm text-ink/60 mb-6">
        Every ban ever issued, newest first. Lifting removes all active bans for that player.
      </p>
      <div className="pixl-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b-2 border-ink bg-parch">
              <th className="p-3">Player</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Banned by</th>
              <th className="p-3">Expires</th>
              <th className="p-3">Status</th>
              <th className="p-3">Issued</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink/10">
            {bans.map((b) => {
              const active = banIsActive(b);
              return (
                <tr key={b.id} className="hover:bg-cream">
                  <td className="p-3">
                    <Link href={`/players/${b.user_id}`} className="font-bold hover:text-brand">
                      {b.users?.display_name ?? b.user_id}
                    </Link>
                  </td>
                  <td className="p-3 max-w-64">
                    <div className="truncate">{b.reason || "—"}</div>
                  </td>
                  <td className="p-3 text-ink/70">{b.banned_by}</td>
                  <td className="p-3 text-ink/60">
                    {b.expires_at ? new Date(b.expires_at).toLocaleString() : "never"}
                  </td>
                  <td className="p-3">
                    {active ? (
                      <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-brand text-white">
                        active
                      </span>
                    ) : b.lifted_at ? (
                      <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-mint/30 dark:bg-mint/20">
                        lifted
                      </span>
                    ) : (
                      <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-ink/10">
                        expired
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-ink/60">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">{active && <LiftBanForm userId={b.user_id} />}</td>
                </tr>
              );
            })}
            {bans.length === 0 && (
              <tr>
                <td className="p-5 text-ink/50" colSpan={7}>
                  No bans issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-pixel text-2xl md:text-3xl text-ink mt-10 mb-3">Ban log</h2>
      <p className="text-sm text-ink/60 mb-4">
        Every ban and lift action with who did it, newest first.
      </p>
      <div className="pixl-card divide-y-2 divide-ink/10">
        {log.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">No ban actions yet.</div>
        )}
        {log.map((r) => (
          <div key={r.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span
              className={`font-pixel px-2 py-0.5 border-2 border-ink shrink-0 ${
                r.action === "ban"
                  ? "bg-brand/15 dark:bg-brand/30"
                  : "bg-mint/30 dark:bg-mint/20"
              }`}
            >
              {r.action === "ban" ? "banned" : "lifted"}
            </span>
            <div className="flex-1 min-w-48">
              <span className="font-bold">{r.actor}</span>
              {" → "}
              <Link href={`/players/${r.user_id}`} className="font-bold hover:text-brand">
                {r.player_name}
              </Link>
              <div className="text-ink/70 break-words">{r.detail}</div>
            </div>
            <div className="text-xs text-ink/50 shrink-0">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
