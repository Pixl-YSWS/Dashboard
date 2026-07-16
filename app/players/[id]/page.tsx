import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { banIsActive, getPlayer } from "@/lib/db";
import { slackHandle } from "@/lib/slack";
import { BanForm, LiftBanForm, NotifyForm, WarnForm } from "@/app/_components/Moderate";
import { StatusBadge } from "@/app/_components/ProjectBadges";

export const dynamic = "force-dynamic";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-ink mb-3 flex items-center gap-2">
        {title}
        {count !== undefined && (
          <span className="badge bg-black/[0.05] text-ink/60 dark:bg-white/[0.08]">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="pixl-card p-4">
      <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${tone ?? "text-ink"}`}>{value}</div>
    </div>
  );
}

function fmt(n: number): string {
  return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1);
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
  const handle = await slackHandle(user.slack_id);

  const pixels = Math.round((Number(user.pixels) || 0) * 100) / 100;
  const approvedHours =
    Math.round(
      projects
        .filter((p) => p.status === "approved")
        .reduce((s, p) => s + (Number(p.approved_hours) || 0), 0) * 10,
    ) / 10;
  const initials =
    (user.display_name || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div>
      <Link href="/players" className="text-sm text-brand font-medium hover:underline">
        ← All players
      </Link>

      <div className="flex items-start gap-4 flex-wrap mt-3 mb-5">
        <span className="grid place-items-center w-14 h-14 rounded-full bg-brand/15 text-brand text-lg font-bold shrink-0">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-ink tracking-tight break-words">
              {user.display_name}
            </h1>
            {activeBan && (
              <span className="badge bg-rose-600 text-white">
                Banned{" "}
                {activeBan.expires_at
                  ? `until ${new Date(activeBan.expires_at).toLocaleDateString()}`
                  : "forever"}
              </span>
            )}
          </div>
          <div className="text-sm text-ink/55 mt-1 break-words">
            {handle ? `${handle} · ` : ""}
            {user.slack_id ? (
              <span className="font-mono">{user.slack_id}</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">no Slack id — can&apos;t DM</span>
            )}{" "}
            · joined {new Date(user.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Pixels" value={fmt(pixels)} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Approved hrs" value={`${fmt(approvedHours)}h`} />
        <Stat label="Projects" value={String(projects.length)} />
        <Stat label="Violations" value={String(violations.length)} />
      </div>

      <div className="pixl-card p-5 mb-8">
        <div className="text-base font-semibold mb-3">Moderate</div>
        <div className="flex flex-col gap-3">
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
      </div>

      <Section title="Projects" count={projects.length}>
        <div className="pixl-card divide-y divide-[var(--line)]">
          {projects.length === 0 && (
            <div className="p-4 text-ink/50 text-sm">No projects yet.</div>
          )}
          {projects.map((p) => (
            <div key={p.id} className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/projects/${p.id}`} className="font-semibold hover:text-brand">
                  {p.name}
                </Link>
                <StatusBadge status={p.status} />
                {p.status === "approved" && p.approved_hours != null && (
                  <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {fmt(Number(p.approved_hours))} px
                  </span>
                )}
              </div>
              {p.description && (
                <div className="text-sm text-ink/70 mt-1 break-words">{p.description}</div>
              )}
              <div className="text-xs text-ink/50 mt-1 flex gap-3 flex-wrap">
                {p.repo_url && (
                  <a className="underline text-brand" href={p.repo_url} target="_blank" rel="noreferrer">
                    repo
                  </a>
                )}
                {p.demo_url && (
                  <a className="underline text-brand" href={p.demo_url} target="_blank" rel="noreferrer">
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

      <Section title="Violations" count={violations.length}>
        <div className="pixl-card divide-y divide-[var(--line)]">
          {violations.length === 0 && (
            <div className="p-4 text-ink/50 text-sm">Clean record.</div>
          )}
          {violations.map((v) => (
            <div key={v.id} className="p-3 flex gap-3 items-baseline">
              <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
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

      <Section title="Bans" count={bans.length}>
        <div className="pixl-card divide-y divide-[var(--line)]">
          {bans.length === 0 && <div className="p-4 text-ink/50 text-sm">Never banned.</div>}
          {bans.map((b) => (
            <div key={b.id} className="p-3 text-sm flex gap-3 items-baseline flex-wrap">
              <span
                className={`badge ${
                  banIsActive(b)
                    ? "bg-rose-600 text-white"
                    : "bg-black/[0.05] text-ink/60 dark:bg-white/[0.08]"
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
              <tr className="text-left border-b border-[var(--line)] text-ink/60">
                <th className="p-2 font-medium">Scene</th>
                <th className="p-2 font-medium">X</th>
                <th className="p-2 font-medium">Y</th>
                <th className="p-2 font-medium">Facing</th>
                <th className="p-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {states.map((s) => (
                <tr key={s.scene}>
                  <td className="p-2 font-mono">{s.scene}</td>
                  <td className="p-2 tabular-nums">{Math.round(s.pos_x)}</td>
                  <td className="p-2 tabular-nums">{Math.round(s.pos_y)}</td>
                  <td className="p-2">{s.direction}</td>
                  <td className="p-2 text-ink/60">{new Date(s.updated_at).toLocaleString()}</td>
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
        <div className="pixl-card divide-y divide-[var(--line)]">
          {actions.length === 0 && (
            <div className="p-4 text-ink/50 text-sm">No moderation actions yet.</div>
          )}
          {actions.map((a) => (
            <div key={a.id} className="p-3 text-sm flex gap-3 items-baseline flex-wrap">
              <span className="badge bg-black/[0.05] text-ink/60 dark:bg-white/[0.08]">
                {a.action}
              </span>
              <span className="flex-1 break-words">{a.detail}</span>
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
