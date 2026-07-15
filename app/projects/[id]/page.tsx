import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePerm, canView } from "@/lib/guard";
import { getProject } from "@/lib/db";
import { fetchCommits } from "@/lib/github";
import {
  reReviewProject,
  archiveProject,
  rejectProject,
  unrejectProject,
} from "@/app/actions";
import { LevelBadge, ShipBadges, StatusBadge } from "@/app/_components/ProjectBadges";
import { CommitList } from "@/app/_components/CommitList";
import { slackHandle } from "@/lib/slack";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await requirePagePerm(["review", "warn", "ban"]);
  const { id } = await params;
  const { error } = await searchParams;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) notFound();
  const data = await getProject(projectId);
  if (!data) notFound();
  const { project, journals, verdicts } = data;
  const totalHours = Math.round(journals.reduce((s, j) => s + (Number(j.hours) || 0), 0) * 10) / 10;
  const commits = await fetchCommits(project.repo_url);
  const ownerHandle = await slackHandle(project.users?.slack_id);
  const canReview = canView(access, ["review"]);
  const canReReview =
    canReview && (project.status === "approved" || project.status === "needs_changes");

  return (
    <div>
      <Link href="/projects" className="text-sm text-brand font-bold underline">
        ← all projects
      </Link>
      <div className="flex items-start gap-4 mt-2 mb-1">
        {project.image_url && (
          <img
            src={project.image_url}
            alt=""
            className="w-20 h-20 md:w-24 md:h-24 object-cover border border-[var(--line)] rounded-xl shrink-0"
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-ink tracking-tight break-words">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
            <LevelBadge level={project.level} />
            <ShipBadges project={project} />
            {project.archived_at && (
              <span className="badge bg-ink/20 whitespace-nowrap">
                archived
              </span>
            )}
            {project.rejected_at && (
              <span className="badge bg-red-700 text-white whitespace-nowrap">
                rejected
              </span>
            )}
          </div>
          <div className="text-sm text-ink/60 mt-1 flex gap-x-3 gap-y-1 flex-wrap">
            <span>
              by{" "}
              {project.users ? (
                <Link href={`/players/${project.user_id}`} className="font-bold hover:text-brand">
                  {ownerHandle ?? project.users.slack_id ?? project.users.display_name}
                </Link>
              ) : (
                project.user_id
              )}
            </span>
            <span>created {new Date(project.created_at).toLocaleString()}</span>
            {project.shipped_at && (
              <span>shipped {new Date(project.shipped_at).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="pixl-card p-3 my-4 text-sm font-bold text-red-700">{error}</div>
      )}

      {project.rejected_at && project.reject_reason && (
        <div className="mt-4 border border-rose-300 dark:border-rose-500/40 rounded-lg bg-red-700/10 p-3 text-sm">
          <span className="font-pixel text-red-700">rejection reason</span>
          <div className="mt-1 break-words">{project.reject_reason}</div>
        </div>
      )}
      {project.system_note && (
        <div className="mt-4 border border-brand/30 rounded-lg bg-brand/10 dark:bg-brand/20 p-3 text-sm font-bold text-brand">
          {project.system_note}
        </div>
      )}

      <div className="pixl-card p-5 my-6">
        {project.description ? (
          <p className="text-sm break-words">{project.description}</p>
        ) : (
          <p className="text-sm text-ink/50">No description.</p>
        )}
        {project.is_update && project.update_notes && (
          <div className="mt-3 border border-[var(--line)] rounded-lg bg-parch p-3 text-sm">
            <span className="font-pixel">what changed since last approval</span>
            <div className="mt-1 whitespace-pre-wrap break-words">{project.update_notes}</div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap mt-4 text-sm font-bold">
          {project.repo_url && (
            <a
              href={project.repo_url}
              target="_blank"
              rel="noreferrer"
              className="pixl-btn bg-ink dark:bg-gray-700 text-white"
            >
              Repo
            </a>
          )}
          {project.demo_url && (
            <a
              href={project.demo_url}
              target="_blank"
              rel="noreferrer"
              className="pixl-btn bg-ink dark:bg-gray-700 text-white"
            >
              Demo
            </a>
          )}
          {!project.repo_url && !project.demo_url && (
            <span className="text-ink/40 font-normal">No links yet.</span>
          )}
        </div>
        {project.hackatime_projects?.length > 0 && (
          <div className="text-xs text-ink/50 mt-3">
            hackatime: {project.hackatime_projects.join(", ")}
          </div>
        )}
        {project.review_note && (
          <div className="mt-4 border border-[var(--line)] rounded-lg bg-parch p-3 text-sm">
            <span className="font-pixel">reviewer note</span>
            <div className="mt-1 break-words">{project.review_note}</div>
          </div>
        )}
      </div>

      {canReview && (
        <div className="pixl-card p-4 mb-8">
          <div className="font-pixel text-xl mb-1">Staff actions</div>
          <p className="text-sm text-ink/60 mb-3">
            Everything here is reversible and kept in history — nothing is erased.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {canReReview && (
              <form action={reReviewProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="pixl-btn bg-blue-700 text-white text-sm">
                  Send back to review
                </button>
              </form>
            )}
            <form action={archiveProject}>
              <input type="hidden" name="projectId" value={project.id} />
              {project.archived_at && <input type="hidden" name="unarchive" value="1" />}
              <button className="pixl-btn bg-white dark:bg-gray-800 text-ink text-sm">
                {project.archived_at ? "Unarchive" : "Archive"}
              </button>
            </form>
            {project.rejected_at && (
              <form action={unrejectProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="pixl-btn bg-mint text-ink text-sm">Restore (un-reject)</button>
              </form>
            )}
          </div>
          {!project.rejected_at && (
            <form action={rejectProject} className="flex flex-wrap gap-2 items-start mt-3">
              <input type="hidden" name="projectId" value={project.id} />
              <input
                name="reason"
                required
                placeholder="Reason for permanent rejection…"
                className="pixl-input flex-1 min-w-64 text-sm"
              />
              <button className="pixl-btn bg-red-700 text-white text-sm">Reject / ban</button>
            </form>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="pixl-card p-4">
          <div className="text-3xl md:text-4xl font-bold text-brand">{totalHours}h</div>
          <div className="font-pixel text-ink/70 text-sm">
            logged
            {project.approved_hours !== null && ` · ${project.approved_hours}h credited`}
          </div>
        </div>
        <div className="pixl-card p-4">
          <div className="text-3xl md:text-4xl font-bold text-brand">{journals.length}</div>
          <div className="font-pixel text-ink/70 text-sm">journal entries</div>
        </div>
        <div className="pixl-card p-4 col-span-2 sm:col-span-1">
          <div className="text-3xl md:text-4xl font-bold text-brand">{commits.commits.length}</div>
          <div className="font-pixel text-ink/70 text-sm">recent commits</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-ink tracking-tight mb-3">Commits</h2>
      <div className="pixl-card mb-8">
        <CommitList result={commits} />
      </div>

      <h2 className="text-lg font-semibold text-ink tracking-tight mb-3">Journal</h2>
      <div className="pixl-card divide-y divide-[var(--line)] mb-8">
        {journals.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">No journal entries yet.</div>
        )}
        {journals.map((j) => (
          <div key={j.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
              <span className="badge bg-parch">
                {Math.round((Number(j.hours) || 0) * 10) / 10}h
              </span>
              <span className="text-xs text-ink/50">
                {new Date(j.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{j.content}</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-ink tracking-tight mb-3">Review history</h2>
      <div className="pixl-card divide-y divide-[var(--line)]">
        {verdicts.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">Not reviewed yet.</div>
        )}
        {verdicts.map((v) => (
          <div key={v.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span
              className={`badge shrink-0 ${
                v.action === "project_approved"
                  ? "bg-emerald-600/20 dark:bg-emerald-600/30"
                  : v.action === "review_reverted"
                    ? "bg-blue-600/20 dark:bg-blue-600/30"
                    : "bg-brand/15 dark:bg-brand/30"
              }`}
            >
              {v.action === "project_approved"
                ? "approved"
                : v.action === "review_reverted"
                  ? "reverted"
                  : "sent back"}
            </span>
            <div className="flex-1 min-w-48">
              <span className="font-bold">{v.actor}</span>
              <div className="text-ink/70 break-words">{v.detail}</div>
            </div>
            <div className="text-xs text-ink/50 shrink-0">
              {new Date(v.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
