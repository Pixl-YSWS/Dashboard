import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, ALL_PERMISSIONS } from "@/lib/guard";
import { listAdmins } from "@/lib/db";
import { addAdmin, removeAdmin, updateAdminPerms } from "@/app/actions";
import { slackHandles } from "@/lib/slack";

export const dynamic = "force-dynamic";

const PERM_INFO: Record<string, { label: string; desc: string }> = {
  warn: { label: "Warn", desc: "Send warnings to players" },
  ban: { label: "Ban", desc: "Ban and unban players" },
  notify: { label: "Notify", desc: "Send broadcast notifications" },
  review: { label: "Review", desc: "Review the ship queue, credit hours" },
};

function PermToggles({
  name,
  checked,
}: {
  name: string;
  checked: (p: string) => boolean;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {ALL_PERMISSIONS.map((p) => (
        <label
          key={p}
          className="flex items-start gap-2.5 rounded-lg border border-[var(--line)] p-2.5 cursor-pointer transition-colors has-[:checked]:border-brand/40 has-[:checked]:bg-brand/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <input
            type="checkbox"
            name={name}
            value={p}
            defaultChecked={checked(p)}
            className="mt-0.5 w-4 h-4 accent-[var(--color-brand)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-none">{PERM_INFO[p].label}</span>
            <span className="block text-xs text-ink/55 mt-1">{PERM_INFO[p].desc}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

const PER = 8;

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const { page } = await searchParams;
  const allAdmins = await listAdmins();
  const pages = Math.max(1, Math.ceil(allAdmins.length / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const admins = allAdmins.slice(start, start + PER);
  const handles = await slackHandles(admins.map((a) => a.slack_id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Sub-admins</h1>
        <p className="text-sm text-ink/55 mt-1 max-w-2xl">
          Owners always have every permission. Sub-admins sign in with Slack and only get the
          permissions you grant here.
        </p>
      </div>

      <div className="pixl-card p-5 md:p-6">
        <div className="text-base font-semibold mb-4">Add a sub-admin</div>
        <form action={addAdmin} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Name</span>
              <input
                name="name"
                placeholder="e.g. Alex Rivera"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Slack member ID</span>
              <input
                name="slackId"
                required
                placeholder="U0XXXXXXX"
                className="pixl-input w-full text-sm font-mono"
              />
              <span className="block text-xs text-ink/45 mt-1">
                Slack → profile → ⋯ → Copy member ID
              </span>
            </label>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Permissions</div>
            <PermToggles name="perms" checked={(p) => p === "review"} />
          </div>

          <div className="flex justify-end">
            <button className="pixl-btn bg-brand text-white border-transparent">
              Add sub-admin
            </button>
          </div>
        </form>
      </div>

      <div>
        <div className="text-sm font-medium text-ink/60 mb-3">
          {allAdmins.length} sub-admin{allAdmins.length === 1 ? "" : "s"}
        </div>
        {allAdmins.length === 0 ? (
          <div className="pixl-card p-8 text-center text-ink/55 text-sm">
            No sub-admins yet. Add someone above to share the workload.
          </div>
        ) : (
          <div className="space-y-4">
            {admins.map((a) => {
              const handle = (a.slack_id && handles.get(a.slack_id)) ?? a.slack_id;
              const initials =
                (a.name || handle || "?")
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "?";
              return (
                <div key={a.slack_id} className="pixl-card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-brand/10 text-brand text-sm font-semibold shrink-0">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{a.name || handle}</div>
                        <div className="text-xs text-ink/50 truncate font-mono">
                          {handle}
                          {a.added_by ? ` · added by ${a.added_by}` : ""}
                        </div>
                      </div>
                    </div>
                    <form action={removeAdmin}>
                      <input type="hidden" name="slackId" value={a.slack_id} />
                      <button className="pixl-btn bg-transparent text-rose-600 border-rose-200 dark:border-rose-500/30 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        Remove
                      </button>
                    </form>
                  </div>

                  <form action={updateAdminPerms} className="mt-4">
                    <input type="hidden" name="slackId" value={a.slack_id} />
                    <PermToggles name="perms" checked={(p) => a.permissions.includes(p)} />
                    <div className="flex justify-end mt-3">
                      <button className="pixl-btn bg-[var(--surface)] text-ink text-sm">
                        Save permissions
                      </button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 mt-4 text-sm">
            <span className="text-ink/50">
              Showing {start + 1}–{Math.min(start + PER, allAdmins.length)} of {allAdmins.length}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/admins?page=${cur - 1}`}
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
                href={`/admins?page=${cur + 1}`}
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
    </div>
  );
}
