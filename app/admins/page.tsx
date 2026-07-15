import { redirect } from "next/navigation";
import { requireAdmin, ALL_PERMISSIONS } from "@/lib/guard";
import { listAdmins } from "@/lib/db";
import { addAdmin, removeAdmin, updateAdminPerms } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const admins = await listAdmins();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-2">Sub-admins</h1>
      <p className="text-sm text-ink/60 mb-6">
        Owners (from ADMIN_SLACK_IDS) always have every permission. Sub-admins
        sign in with Slack like you do, but only get the boxes you tick.
      </p>

      <div className="pixl-card p-4 mb-8">
        <div className="font-pixel text-xl mb-3">Add a sub-admin</div>
        <form action={addAdmin} className="flex gap-2 items-center flex-wrap">
          <input
            name="slackId"
            placeholder="Slack ID (U0…)"
            className="pixl-input text-sm"
            required
          />
          <input name="name" placeholder="Name" className="pixl-input text-sm" />
          {ALL_PERMISSIONS.map((p) => (
            <label key={p} className="flex items-center gap-1 text-sm font-bold">
              <input type="checkbox" name="perms" value={p} defaultChecked={p === "warn"} />
              {p}
            </label>
          ))}
          <button className="pixl-btn bg-brand text-white text-sm">Add</button>
        </form>
      </div>

      <div className="pixl-card divide-y divide-[var(--line)]">
        {admins.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">No sub-admins yet.</div>
        )}
        {admins.map((a) => (
          <div key={a.slack_id} className="p-4 flex items-center gap-4 flex-wrap">
            <div className="min-w-40">
              <div className="font-bold">{a.name}</div>
              <div className="text-xs text-ink/50">
                {a.slack_id} · added by {a.added_by || "?"}
              </div>
            </div>
            <form action={updateAdminPerms} className="flex gap-3 items-center flex-1 flex-wrap">
              <input type="hidden" name="slackId" value={a.slack_id} />
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-1 text-sm font-bold">
                  <input
                    type="checkbox"
                    name="perms"
                    value={p}
                    defaultChecked={a.permissions.includes(p)}
                  />
                  {p}
                </label>
              ))}
              <button className="pixl-btn bg-mint text-ink text-sm">Save</button>
            </form>
            <form action={removeAdmin}>
              <input type="hidden" name="slackId" value={a.slack_id} />
              <button className="pixl-btn bg-brand text-white text-sm">Remove</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
