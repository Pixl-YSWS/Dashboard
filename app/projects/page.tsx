import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listProjects } from "@/lib/db";
import { StatusBadge } from "@/app/_components/ProjectBadges";
import { slackHandles } from "@/lib/slack";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  await requirePagePerm(["review", "warn", "ban"]);
  const { q, view } = await searchParams;
  const archived = view === "archived";
  const projects = await listProjects(q, { archived });
  const handles = await slackHandles(projects.map((p) => p.users?.slack_id));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-6">
        <h1 className="text-2xl font-semibold text-ink tracking-tight">
          {archived ? "Archived projects" : "Projects"}
        </h1>
        <Link
          href={archived ? "/projects" : "/projects?view=archived"}
          className="pixl-btn bg-white dark:bg-gray-800 text-ink text-sm"
        >
          {archived ? "← Active projects" : "View archive"}
        </Link>
      </div>
      <form className="mb-5 flex gap-2">
        {archived && <input type="hidden" name="view" value="archived" />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search project names…"
          className="pixl-input flex-1 min-w-0 max-w-72"
        />
        <button className="pixl-btn bg-ink dark:bg-gray-700 text-white">Search</button>
      </form>
      <div className="pixl-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--line)] bg-parch">
              <th className="p-3">Project</th>
              <th className="p-3">Status</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Links</th>
              <th className="p-3">Hackatime</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-cream">
                <td className="p-3 max-w-72">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-bold hover:text-brand"
                  >
                    {p.name}
                  </Link>
                  {p.description && (
                    <div className="text-xs text-ink/50 truncate">{p.description}</div>
                  )}
                </td>
                <td className="p-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="p-3">
                  {p.users ? (
                    <Link href={`/players/${p.user_id}`} className="font-bold hover:text-brand">
                      {(p.users.slack_id && handles.get(p.users.slack_id)) ??
                        p.users.slack_id ??
                        p.users.display_name}
                    </Link>
                  ) : (
                    <span className="text-ink/50">{p.user_id}</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {p.repo_url && (
                      <a
                        href={p.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand font-bold underline"
                      >
                        repo
                      </a>
                    )}
                    {p.demo_url && (
                      <a
                        href={p.demo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand font-bold underline"
                      >
                        demo
                      </a>
                    )}
                    {!p.repo_url && !p.demo_url && <span className="text-ink/40">—</span>}
                  </div>
                </td>
                <td className="p-3 text-ink/70">
                  {p.hackatime_projects?.length ? p.hackatime_projects.join(", ") : "—"}
                </td>
                <td className="p-3 text-ink/60">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td className="p-5 text-ink/50" colSpan={6}>
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
