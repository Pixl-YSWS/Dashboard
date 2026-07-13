import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listShippedProjects } from "@/lib/db";
import { reviewProject } from "@/app/actions";

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
  await requirePagePerm(["review"]);
  const { error } = await searchParams;
  const queue = await listShippedProjects();

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

              <form action={reviewProject} className="mt-4 flex flex-wrap gap-2 items-start">
                <input type="hidden" name="projectId" value={p.id} />
                <textarea
                  name="note"
                  placeholder="Reviewer note (required to send back, optional on approve)"
                  className="pixl-input flex-1 min-w-64 text-sm"
                  rows={2}
                />
                <button
                  name="verdict"
                  value="approved"
                  className="pixl-btn bg-emerald-700 text-white"
                >
                  Approve
                </button>
                <button
                  name="verdict"
                  value="needs_changes"
                  className="pixl-btn bg-red-700 text-white"
                >
                  Send back
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
