import type { CommitResult } from "@/lib/github";

export function CommitList({ result }: { result: CommitResult }) {
  if (result.error === "not_github")
    return <div className="p-4 text-ink/50 text-sm">Repo link isn&apos;t a GitHub URL.</div>;
  if (result.error === "not_found")
    return (
      <div className="p-4 text-brand text-sm font-bold">
        {result.repo} — repo not found or private (404).
      </div>
    );
  if (result.error)
    return (
      <div className="p-4 text-ink/50 text-sm">
        Couldn&apos;t load commits ({result.error}).
      </div>
    );
  if (result.commits.length === 0)
    return <div className="p-4 text-ink/50 text-sm">No commits.</div>;

  return (
    <div className="divide-y-2 divide-ink/10">
      {result.commits.map((c) => (
        <div key={c.sha} className="p-3 flex items-baseline gap-3 text-sm">
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-brand shrink-0 hover:underline"
          >
            {c.sha}
          </a>
          <span className="flex-1 min-w-0 break-words">{c.message}</span>
          <span className="text-xs text-ink/50 shrink-0 hidden sm:inline">{c.author}</span>
          <span className="text-xs text-ink/40 shrink-0">
            {c.date ? new Date(c.date).toLocaleDateString() : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
