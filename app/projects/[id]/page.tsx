import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { getProject } from "@/lib/db";
import { StatusBadge } from "@/app/_components/ProjectBadges";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePerm(["review", "warn", "ban"]);
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) notFound();
  const data = await getProject(projectId);
  if (!data) notFound();
  const { project, journals, verdicts } = data;
  const totalHours = Math.round(journals.reduce((s, j) => s + (Number(j.hours) || 0), 0) * 10) / 10;

  return (
    <div>
      <Link href="/projects" className="text-sm text-brand font-bold underline">
        ← all projects
      </Link>
      <div className="flex items-center gap-3 flex-wrap mt-2 mb-1">
        <h1 className="font-pixel text-4xl md:text-5xl text-brand break-words">{project.name}</h1>
        <StatusBadge status={project.status} />
      </div>
      <div className="text-sm text-ink/60 mb-6 flex gap-x-3 gap-y-1 flex-wrap">
        <span>
          by{" "}
          {project.users ? (
            <Link href={`/players/${project.user_id}`} className="font-bold hover:text-brand">
              {project.users.display_name}
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

      <div className="pixl-card p-5 mb-8">
        {project.description ? (
          <p className="text-sm break-words">{project.description}</p>
        ) : (
          <p className="text-sm text-ink/50">No description.</p>
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
          <div className="mt-4 border-2 border-ink bg-parch p-3 text-sm">
            <span className="font-pixel">reviewer note</span>
            <div className="mt-1 break-words">{project.review_note}</div>
          </div>
        )}
      </div>

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
          <div className="text-3xl md:text-4xl font-bold text-brand">{verdicts.length}</div>
          <div className="font-pixel text-ink/70 text-sm">review verdicts</div>
        </div>
      </div>

      <h2 className="font-pixel text-2xl md:text-3xl text-ink mb-3">Journal</h2>
      <div className="pixl-card divide-y-2 divide-ink/10 mb-8">
        {journals.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">No journal entries yet.</div>
        )}
        {journals.map((j) => (
          <div key={j.id} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
              <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-parch">
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

      <h2 className="font-pixel text-2xl md:text-3xl text-ink mb-3">Review history</h2>
      <div className="pixl-card divide-y-2 divide-ink/10">
        {verdicts.length === 0 && (
          <div className="p-5 text-ink/50 text-sm">Not reviewed yet.</div>
        )}
        {verdicts.map((v) => (
          <div key={v.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span
              className={`font-pixel px-2 py-0.5 border-2 border-ink shrink-0 ${
                v.action === "project_approved"
                  ? "bg-emerald-600/20 dark:bg-emerald-600/30"
                  : "bg-brand/15 dark:bg-brand/30"
              }`}
            >
              {v.action === "project_approved" ? "approved" : "sent back"}
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
