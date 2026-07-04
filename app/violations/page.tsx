import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { listViolations } from "@/lib/db";
import { BanForm, WarnForm } from "@/app/_components/Moderate";

export const dynamic = "force-dynamic";

export default async function ViolationsPage() {
  await requireAdmin();
  const violations = await listViolations(200);

  return (
    <div>
      <h1 className="font-pixel text-5xl text-brand mb-2">Violations</h1>
      <p className="text-sm text-ink/60 mb-6">
        Every censored chat message and rejected display name, newest first.
      </p>
      <div className="pixl-card divide-y-2 divide-ink/10">
        {violations.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">No violations logged yet.</div>
        )}
        {violations.map((v) => (
          <div key={v.id} className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`font-pixel text-sm px-2 py-0.5 border-2 border-ink ${
                  v.kind === "chat" ? "bg-tang/20 dark:bg-tang/30" : "bg-brand/15 dark:bg-brand/30"
                }`}
              >
                {v.kind}
              </span>
              <Link
                href={`/players/${v.user_id}`}
                className="font-bold hover:text-brand"
              >
                {v.users?.display_name ?? v.user_id}
              </Link>
              {!v.users?.slack_id && (
                <span className="text-xs text-ink/40">(no slack id — can't DM)</span>
              )}
              <span className="text-xs text-ink/50 ml-auto">
                {new Date(v.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-sm bg-parch border-2 border-ink/20 px-3 py-1.5 my-2 break-words">
              {v.content}
            </div>
            <div className="flex gap-3 flex-wrap">
              <WarnForm userId={v.user_id} compact />
              <BanForm userId={v.user_id} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
