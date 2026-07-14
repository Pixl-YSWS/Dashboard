import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { banIsActive, getPlayer } from "@/lib/db";
import { BanForm, LiftBanForm, NotifyForm, WarnForm } from "@/app/_components/Moderate";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-pixel text-2xl text-ink mb-2">{title}</h2>
      {children}
    </section>
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requirePagePerm(["warn", "ban"]);
  const can = (p: string) => access.isSuper || access.perms.has(p);
  const { id } = await params;
  const data = await getPlayer(id);
  if (!data) notFound();
  const { user, states, projects, violations, bans, actions } = data;
  const activeBan = bans.find(banIsActive) ?? null;

  return (
    <div>
      <Link href="/players" className="text-sm text-brand font-bold underline">
        ← all players
      </Link>
      <div className="flex items-center gap-4 flex-wrap mt-2 mb-1">
        <h1 className="font-pixel text-4xl md:text-5xl text-brand break-words">{user.display_name}</h1>
        {activeBan && (
          <span className="font-pixel px-3 py-1 border-2 border-ink bg-brand text-white">
            banned {activeBan.expires_at ? `until ${new Date(activeBan.expires_at).toLocaleString()}` : "forever"}
          </span>
        )}
      </div>
      <div className="text-sm text-ink/60 mb-6">
        {user.slack_id ? `slack ${user.slack_id}` : "no slack id on file"} ·{" "}
        {user.oauth_provider}/{user.oauth_id} · skin {user.skin} · joined{" "}
        {new Date(user.created_at).toLocaleString()}
      </div>

      <div className="pixl-card p-4 mb-8 flex flex-col gap-3">
        <div className="font-pixel text-xl">Moderate</div>
        {can("warn") && <WarnForm userId={user.id} />}
        {can("ban") && <BanForm userId={user.id} isBanned={!!activeBan} />}
        {can("ban") && activeBan && <LiftBanForm userId={user.id} />}
        {can("notify") && <NotifyForm userId={user.id} />}
        {!can("warn") && !can("ban") && !can("notify") && (
          <div className="text-sm text-ink/50">
            You don&apos;t have any moderation permissions.
          </div>
        )}
      </div>

      <Section title={`Projects (${projects.length})`}>
        <div className="pixl-card divide-y-2 divide-ink/10">
          {projects.length === 0 && (
            <div className="p-4 text-ink/50 text-sm">No projects yet.</div>
          )}
          {projects.map((p) => (
            <div key={p.id} className="p-4">
              <Link href={`/projects/${p.id}`} className="font-bold hover:text-brand">
                {p.name}
              </Link>
              {p.description && (
                <div className="text-sm text-ink/70 mt-1">{p.description}</div>
              )}
              <div className="text-xs text-ink/50 mt-1 flex gap-3 flex-wrap">
                {p.repo_url && (
                  <a className="underline text-brand" href={p.repo_url} target="_blank">
                    repo
                  </a>
                )}
                {p.demo_url && (
                  <a className="underline text-brand" href={p.demo_url} target="_blank">
                    demo
                  </a>
                )}
                {p.hackatime_projects.length > 0 && (
                  <span>hackatime: {p.hackatime_projects.join(", ")}</span>
                )}
                <span>created {new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Violations (${violations.length})`}>
        <div className="pixl-card divide-y-2 divide-ink/10">
          {violations.length === 0 && (
            <div className="p-4 text-ink/50 text-sm">Clean record.</div>
          )}
          {violations.map((v) => (
            <div key={v.id} className="p-3 flex gap-3 items-baseline">
              <span className="font-pixel text-xs px-2 border-2 border-ink bg-tang/20 dark:bg-tang/30">
                {v.kind}
              </span>
              <span className="text-sm flex-1 break-words">{v.content}</span>
              <span className="text-xs text-ink/50 shrink-0">
                {new Date(v.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Bans (${bans.length})`}>
        <div className="pixl-card divide-y-2 divide-ink/10">
          {bans.length === 0 && <div className="p-4 text-ink/50 text-sm">Never banned.</div>}
          {bans.map((b) => (
            <div key={b.id} className="p-3 text-sm flex gap-3 items-baseline flex-wrap">
              <span
                className={`font-pixel text-xs px-2 border-2 border-ink ${
                  banIsActive(b) ? "bg-brand text-white" : "bg-ink/10"
                }`}
              >
                {banIsActive(b) ? "active" : b.lifted_at ? "lifted" : "expired"}
              </span>
              <span className="flex-1">
                {b.reason || "(no reason)"} — by {b.banned_by || "?"}
              </span>
              <span className="text-xs text-ink/50">
                {new Date(b.created_at).toLocaleString()}
                {b.expires_at ? ` → ${new Date(b.expires_at).toLocaleString()}` : " → forever"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Last known positions">
        <div className="pixl-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b-2 border-ink bg-parch">
                <th className="p-2">Scene</th>
                <th className="p-2">X</th>
                <th className="p-2">Y</th>
                <th className="p-2">Facing</th>
                <th className="p-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-ink/10">
              {states.map((s) => (
                <tr key={s.scene}>
                  <td className="p-2 font-mono">{s.scene}</td>
                  <td className="p-2">{Math.round(s.pos_x)}</td>
                  <td className="p-2">{Math.round(s.pos_y)}</td>
                  <td className="p-2">{s.direction}</td>
                  <td className="p-2 text-ink/60">
                    {new Date(s.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {states.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-ink/50">
                    Never entered the world.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Moderation log">
        <div className="pixl-card divide-y-2 divide-ink/10">
          {actions.length === 0 && (
            <div className="p-4 text-ink/50 text-sm">No moderation actions yet.</div>
          )}
          {actions.map((a) => (
            <div key={a.id} className="p-3 text-sm flex gap-3 items-baseline flex-wrap">
              <span className="font-pixel text-xs px-2 border-2 border-ink bg-parch">
                {a.action}
              </span>
              <span className="flex-1">{a.detail}</span>
              <span className="text-xs text-ink/50">
                {a.actor} · {new Date(a.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
