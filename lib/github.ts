export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface CommitResult {
  repo: string | null;
  commits: Commit[];
  error: string | null;
}

function parseRepo(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("github.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

// Newest commits for a repo via the public GitHub API. Auth via GITHUB_TOKEN
// when present to lift the 60/hr unauthenticated rate limit.
export async function fetchCommits(repoUrl: string | null, limit = 50): Promise<CommitResult> {
  if (!repoUrl) return { repo: null, commits: [], error: null };
  const parsed = parseRepo(repoUrl);
  if (!parsed) return { repo: null, commits: [], error: "not_github" };

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pixl-dashboard",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const r = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=${limit}`,
      { headers, signal: AbortSignal.timeout(8000), next: { revalidate: 300 } },
    );
    if (r.status === 404) return { repo: `${parsed.owner}/${parsed.repo}`, commits: [], error: "not_found" };
    if (!r.ok) return { repo: `${parsed.owner}/${parsed.repo}`, commits: [], error: `http_${r.status}` };
    const json = (await r.json()) as any[];
    const commits: Commit[] = (Array.isArray(json) ? json : []).map((c) => ({
      sha: String(c.sha ?? "").slice(0, 7),
      message: String(c.commit?.message ?? "").split("\n")[0].slice(0, 200),
      author: String(c.author?.login ?? c.commit?.author?.name ?? "?"),
      date: String(c.commit?.author?.date ?? ""),
      url: String(c.html_url ?? ""),
    }));
    return { repo: `${parsed.owner}/${parsed.repo}`, commits, error: null };
  } catch {
    return { repo: `${parsed.owner}/${parsed.repo}`, commits: [], error: "fetch_failed" };
  }
}
