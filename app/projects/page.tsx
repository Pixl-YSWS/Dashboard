import Link from "next/link";
import { requireAdmin } from "@/lib/guard";
import { listProjects } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const projects = await listProjects(q);

  return (
    <div>
      <h1 className="font-pixel text-5xl text-brand mb-6">Projects</h1>
      <form className="mb-5 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search project names…"
          className="pixl-input w-72"
        />
        <button className="pixl-btn bg-ink dark:bg-gray-700 text-white">Search</button>
      </form>
      <div className="pixl-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b-2 border-ink bg-parch">
              <th className="p-3">Project</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Links</th>
              <th className="p-3">Hackatime</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink/10">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-cream">
                <td className="p-3 max-w-72">
                  <div className="font-bold">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-ink/50 truncate">{p.description}</div>
                  )}
                </td>
                <td className="p-3">
                  {p.users ? (
                    <Link href={`/players/${p.user_id}`} className="font-bold hover:text-brand">
                      {p.users.display_name}
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
                <td className="p-5 text-ink/50" colSpan={5}>
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
