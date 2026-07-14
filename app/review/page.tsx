import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listShippedProjects } from "@/lib/db";
import { fetchCommits } from "@/lib/github";
import { ReviewForm } from "@/app/_components/ReviewForm";
import { CommitList } from "@/app/_components/CommitList";
import { ReviewTabs } from "@/app/_components/ReviewTabs";
import { LevelBadge, ShipBadges } from "@/app/_components/ProjectBadges";
import { slackHandle } from "@/lib/slack";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; i?: string }>;
}) {
  const access = await requirePagePerm(["review"]);
  const { error, i } = await searchParams;
  const queue = await listShippedProjects();

  const total = queue.length;
  const idx = Math.min(Math.max(parseInt(i ?? "0", 10) || 0, 0), Math.max(total - 1, 0));
  const p = queue[idx];
  const commits = p ? await fetchCommits(p.repo_url) : null;
  const ownerHandle = p ? await slackHandle(p.users?.slack_id) : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h1 className="font-pixel text-4xl md:text-5xl text-brand">Review queue</h1>
        {total > 0 && (
          <div className="font-pixel text-lg text-ink/70">
            Submission {idx + 1} of {total}
          </div>
        )}
      </div>
      <ReviewTabs isSuper={access.isSuper} />
      <p className="text-sm text-ink/60 mb-6">
        One submission at a time, oldest first — no cherry-picking. Every verdict
        needs feedback. Leave the hours field alone to credit logged hours; you can
        only lower it.
      </p>
      {error && (
        <div className="pixl-card p-3 mb-5 text-sm font-bold text-red-700">{error}</div>
      )}

      {!p ? (
        <div className="pixl-card p-6 text-ink/60">
          Nothing to review — the queue is empty. 🎉
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-5">
            <div className="flex-1 min-w-0 flex flex-col gap-5">
              <div className="pixl-card p-5">
                <div className="flex items-start gap-4">
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt=""
                      className="w-24 h-24 object-cover border-2 border-ink shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/projects/${p.id}`}
                        className="font-pixel text-2xl hover:text-brand"
                      >
                        {p.name}
                      </Link>
                      <LevelBadge level={p.level} />
                      <ShipBadges project={p} />
                    </div>
                    <div className="text-xs text-ink/50 mt-1">
                      by{" "}
                      {p.users ? (
                        <Link
                          href={`/players/${p.user_id}`}
                          className="font-bold hover:text-brand"
                        >
                          {ownerHandle ?? p.users.slack_id ?? p.users.display_name}
                        </Link>
                      ) : (
                        p.user_id
                      )}{" "}
                      · shipped {p.shipped_at ? new Date(p.shipped_at).toUTCString() : "?"}
                    </div>
                  </div>
                </div>

                {p.system_note && (
                  <div className="mt-3 border-2 border-brand bg-brand/10 dark:bg-brand/20 p-3 text-sm font-bold text-brand">
                    {p.system_note}
                  </div>
                )}
                {p.description && <p className="text-sm mt-3">{p.description}</p>}
                {p.is_update && p.update_notes && (
                  <div className="mt-3 border-2 border-ink bg-parch p-3 text-sm">
                    <span className="font-pixel">what changed since last approval</span>
                    <div className="mt-1 whitespace-pre-wrap break-words">{p.update_notes}</div>
                  </div>
                )}
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

              <div className="pixl-card">
                <div className="p-3 border-b-2 border-ink bg-parch font-pixel">
                  Commits{commits?.commits.length ? ` · ${commits.commits.length}` : ""}
                </div>
                {commits && <CommitList result={commits} />}
              </div>
            </div>

            <aside className="lg:w-64 shrink-0">
              <div className="pixl-card p-4 lg:sticky lg:top-6">
                <div className="font-pixel text-ink/70 text-sm mb-1">Logged hours</div>
                <div className="text-4xl font-bold text-brand">{p.hours}h</div>
                <div className="text-sm text-ink/60 mb-3">
                  across {p.entries} journal entr{p.entries === 1 ? "y" : "ies"}
                </div>
                <div className="flex flex-col gap-2 text-sm font-bold">
                  {p.repo_url && (
                    <a
                      href={p.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="pixl-btn bg-ink dark:bg-gray-700 text-white text-center"
                    >
                      Open repo
                    </a>
                  )}
                  {p.demo_url && (
                    <a
                      href={p.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="pixl-btn bg-ink dark:bg-gray-700 text-white text-center"
                    >
                      Open demo
                    </a>
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6">
            <Link
              href={`/review?i=${idx - 1}`}
              className={`pixl-btn bg-white dark:bg-gray-800 text-ink ${
                idx === 0 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              ← Previous
            </Link>
            <span className="text-sm text-ink/50">
              {idx + 1} / {total}
            </span>
            <Link
              href={`/review?i=${idx + 1}`}
              className={`pixl-btn bg-white dark:bg-gray-800 text-ink ${
                idx >= total - 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Next →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
