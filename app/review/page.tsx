import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listShippedProjects, listReviewAudits } from "@/lib/db";
import { ReviewForm } from "@/app/_components/ReviewForm";

export const dynamic = "force-dynamic";

function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await requirePagePerm(["review"]);
  const { error } = await searchParams;
  const [queue, log] = await Promise.all([
    listShippedProjects(),
    access.isSuper ? listReviewAudits() : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="font-pixel text-4xl md:text-5xl text-brand mb-2">Review queue</h1>
      <p className="text-sm text-ink/60 mb-6">
        Shipped projects waiting on a verdict, oldest first. Every verdict requires
        feedback and notifies the player in-game and on Slack. Leave the hours field
        empty to credit the logged hours as-is.
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
                  <Link href={`/projects/${p.id}`} className="font-pixel text-2xl hover:text-brand">
                    {p.name}
                  </Link>
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
              </div>

              {p.description && <p className="text-sm mt-3">{p.description}</p>}
              {p.hackatime_projects?.length > 0 && (
                <div className="text-xs text-ink/50 mt-2">
                  hackatime: {p.hackatime_projects.join(", ")}
                </div>
              )}

              <ReviewForm
                projectId={p.id}
                repoUrl={p.repo_url}
                demoUrl={p.demo_url}
                claimedHours={p.hours}
              />
            </div>
          ))}
        </div>
      )}

      {access.isSuper && (
        <>
          <h2 className="font-pixel text-2xl md:text-3xl text-ink mt-10 mb-3">Review log</h2>
          <p className="text-sm text-ink/60 mb-3">
            Only you can see this — includes whether the reviewer opened the repo and
            demo, how long they spent in each, and any hour adjustments.
          </p>
          <div className="pixl-card divide-y-2 divide-ink/10">
            {log.length === 0 && (
              <div className="p-5 text-ink/50 text-sm">No verdicts yet.</div>
            )}
            {log.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span
                  className={`font-pixel px-2 py-0.5 border-2 border-ink shrink-0 ${
                    r.verdict === "approved"
                      ? "bg-emerald-600/20 dark:bg-emerald-600/30"
                      : "bg-brand/15 dark:bg-brand/30"
                  }`}
                >
                  {r.verdict === "approved" ? "approved" : "sent back"}
                </span>
                <div className="flex-1 min-w-48">
                  <span className="font-bold">{r.reviewer}</span>
                  {" → "}
                  <Link href={`/players/${r.user_id}`} className="font-bold hover:text-brand">
                    {r.player_name}
                  </Link>
                  {" · "}
                  <Link
                    href={`/projects/${r.project_id}`}
                    className="font-bold hover:text-brand"
                  >
                    {r.project_name}
                  </Link>
                  <div className="text-ink/70 break-words">{r.note}</div>
                  <div className="text-xs text-ink/50 mt-1">
                    repo {r.repo_opened ? `✓ ${fmtSeconds(r.repo_seconds)}` : "✗ never opened"}
                    {" · "}
                    demo {r.demo_opened ? `✓ ${fmtSeconds(r.demo_seconds)}` : "✗ never opened"}
                    {" · "}
                    {fmtSeconds(r.total_seconds)} on review
                    {" · "}
                    {r.approved_hours !== null && r.approved_hours !== r.claimed_hours
                      ? `hours ${r.claimed_hours}h → ${r.approved_hours}h`
                      : `${r.claimed_hours}h credited as logged`}
                  </div>
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
