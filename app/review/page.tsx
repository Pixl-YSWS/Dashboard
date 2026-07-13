import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listShippedProjects, listReviewLog } from "@/lib/db";
import { ReviewForm } from "@/app/_components/ReviewForm";

export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  game: "bg-brand text-white",
  website: "bg-blue-600 text-white",
  app: "bg-emerald-600 text-white",
  cli: "bg-gray-700 text-white",
  hardware: "bg-amber-600 text-white",
  other: "bg-ink/20 text-ink",
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await requirePagePerm(["review"]);
  const { error } = await searchParams;
  const [queue, log] = await Promise.all([
    listShippedProjects(),
    access.isSuper ? listReviewLog() : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="font-pixel text-5xl text-brand mb-2">Review queue</h1>
      <p className="text-sm text-ink/60 mb-6">
        Shipped projects waiting on a verdict, oldest first. Approving notifies the
        player in-game and on Slack; sending back requires a note telling them what to fix.
      </p>
      {error && (
        <div className="pixl-card p-3 mb-5 text-sm font-bold text-red-700">{error}</div>
      )}

      {queue.length === 0 ? (
        <div className="pixl-card p-6 text-ink/60">
          Nothing to review — the queue is empty.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {queue.map((p) => (
            <div key={p.id} className="pixl-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-2xl">{p.name}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold uppercase ${TYPE_COLORS[p.type] ?? TYPE_COLORS.other}`}
                    >
                      {p.type}
                    </span>
                  </div>
                  <div className="text-xs text-ink/50 mt-1">
                    by{" "}
                    {p.users ? (
                      <Link
                        href={`/players/${p.user_id}`}
                        className="font-bold hover:text-brand"
                      >
                        {p.users.display_name}
                      </Link>
                    ) : (
                      p.user_id
                    )}{" "}
                    · shipped {p.shipped_at ? new Date(p.shipped_at).toUTCString() : "?"} ·{" "}
                    {p.hours}h across {p.entries} journal entr{p.entries === 1 ? "y" : "ies"}
                  </div>
                </div>
                <div className="flex gap-2 text-sm font-bold">
                  {p.repo_url && (
                    <a
                      href={p.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="pixl-btn bg-ink dark:bg-gray-700 text-white"
                    >
                      Repo
                    </a>
                  )}
                  {p.demo_url && (
                    <a
                      href={p.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="pixl-btn bg-ink dark:bg-gray-700 text-white"
                    >
                      Demo
                    </a>
                  )}
                </div>
              </div>

              {p.description && <p className="text-sm mt-3">{p.description}</p>}
              {p.hackatime_projects?.length > 0 && (
                <div className="text-xs text-ink/50 mt-2">
                  hackatime: {p.hackatime_projects.join(", ")}
                </div>
              )}

              <ReviewForm projectId={p.id} />
            </div>
          ))}
        </div>
      )}

      {access.isSuper && (
        <>
          <h2 className="font-pixel text-3xl text-ink mt-10 mb-3">Review log</h2>
          <div className="pixl-card divide-y-2 divide-ink/10">
            {log.length === 0 && (
              <div className="p-5 text-ink/50 text-sm">No verdicts yet.</div>
            )}
            {log.map((r) => (
              <div key={r.id} className="p-4 flex items-center gap-4 text-sm">
                <span
                  className={`font-pixel px-2 py-0.5 border-2 border-ink shrink-0 ${
                    r.action === "project_approved"
                      ? "bg-emerald-600/20 dark:bg-emerald-600/30"
                      : "bg-brand/15 dark:bg-brand/30"
                  }`}
                >
                  {r.action === "project_approved" ? "approved" : "sent back"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold">{r.actor}</span>
                  {" → "}
                  <Link href={`/players/${r.user_id}`} className="font-bold hover:text-brand">
                    {r.player_name}
                  </Link>
                  <div className="text-ink/70 truncate">{r.detail}</div>
                </div>
                <div className="text-xs text-ink/50 shrink-0">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
