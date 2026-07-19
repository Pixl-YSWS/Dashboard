import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { getProject, listShippedProjects, listSecondReviewProjects, claimReview } from "@/lib/db";
import { fetchCommits, attachCommitStats } from "@/lib/github";
import { fetchUserSpans, attachTrackedTime, fetchTrustFactor, fetchHackatimeReport } from "@/lib/hackatime";
import { yswsShipsFor } from "@/lib/ysws";
import { renderMarkdown } from "@/lib/markdown";
import { db } from "@/lib/db";
import { ReviewForm, type BountyOption } from "@/app/_components/ReviewForm";
import { banProject } from "@/app/actions";
import { ReviewDetailTabs } from "@/app/_components/ReviewDetailTabs";
import { LevelBadge, ShipBadges, StatusBadge } from "@/app/_components/ProjectBadges";
import { slackHandle } from "@/lib/slack";

export const dynamic = "force-dynamic";

function fmtHM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ago(iso: string | null): string {
  if (!iso) return "unknown";
  const d = Math.max(0, Date.now() - new Date(iso).getTime());
  const days = Math.floor(d / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hrs = Math.floor(d / 3_600_000);
  if (hrs >= 1) return `${hrs}h ago`;
  return `${Math.floor(d / 60_000)}m ago`;
}

export default async function ReviewDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await requirePagePerm(["review"]);
  const viewer = access.session.slackId;
  const canSecondPass = access.canSecondPass;
  const { id } = await params;
  const { error } = await searchParams;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) notFound();

  const data = await getProject(projectId);
  if (!data) notFound();
  const { project: p, journals, verdicts } = data;

  const isFinalStage = p.status === "second_review";
  const isOwn = !!p.users?.slack_id && p.users.slack_id === viewer && !access.isSuper;
  const canReview =
    (p.status === "shipped" && !isOwn) || (isFinalStage && canSecondPass);

  const claim = canReview
    ? await claimReview(projectId, viewer)
    : { ok: true as const, by: undefined };
  const claimHandle = !claim.ok && claim.by ? await slackHandle(claim.by) : null;

  const journalHours =
    Math.round(journals.reduce((s, j) => s + (Number(j.hours) || 0), 0) * 10) / 10;
  const hackatimeHours = Math.round(((p.hackatime_seconds ?? 0) / 3600) * 10) / 10;
  const hours = hackatimeHours > 0 ? hackatimeHours : journalHours;
  const htPct = hours > 0 ? Math.round((hackatimeHours / hours) * 100) : 0;

  const formDefaultHours =
    isFinalStage && p.first_pass_hours != null ? p.first_pass_hours : hours;

  const shippedAt = (p as { shipped_at?: string | null }).shipped_at ?? null;
  let bounties: BountyOption[] = [];
  if (shippedAt) {
    const { data: bountyEvents } = await db
      .from("events")
      .select("*")
      .eq("type", "bounty")
      .is("stopped_at", null)
      .lte("starts_at", shippedAt)
      .gt("ends_at", shippedAt);
    bounties = ((bountyEvents ?? []) as {
      id: number;
      name: string;
      config: Record<string, unknown>;
    }[]).map((ev) => ({
      id: ev.id,
      name: ev.name,
      reward: Number(ev.config.reward) || 0,
      description: String(ev.config.description ?? ""),
    }));
  }

  // These calls hit GitHub, Hackatime, the YSWS archive, Slack and the DB.
  // They're independent, so run them concurrently — the page is only as slow as
  // the slowest one, not their sum. The commit stats + tracked-time attach form
  // one chain (both mutate `commits`) that runs alongside the rest.
  const hackatimeProjects = p.hackatime_projects ?? [];
  const tokenPromise = hackatimeProjects.length
    ? db
        .from("users")
        .select("hackatime_token")
        .eq("id", p.user_id)
        .single()
        .then((r) => (r.data as { hackatime_token?: string } | null)?.hackatime_token ?? null)
    : Promise.resolve(null);

  const commitsChain = (async () => {
    const commits = await fetchCommits(p.repo_url);
    await attachCommitStats(commits);
    if (commits.commits.length > 0 && hackatimeProjects.length > 0) {
      const spans = await fetchUserSpans(p.users?.slack_id, await tokenPromise, hackatimeProjects);
      if (spans) attachTrackedTime(commits.commits, spans);
    }
    return commits;
  })();

  const hackatimeReportPromise = hackatimeProjects.length
    ? tokenPromise.then((tok) => fetchHackatimeReport(p.users?.slack_id, tok, hackatimeProjects))
    : Promise.resolve(null);

  const [commits, trust, yswsShips, ownerHandle, queue, hackatimeReport] = await Promise.all([
    commitsChain,
    fetchTrustFactor(p.users?.slack_id),
    yswsShipsFor(p.users?.slack_id, p.repo_url, p.demo_url),
    slackHandle(p.users?.slack_id),
    isFinalStage ? listSecondReviewProjects(viewer) : listShippedProjects(viewer),
    hackatimeReportPromise,
  ]);
  const ownerName = ownerHandle ?? p.users?.display_name ?? p.users?.slack_id ?? p.user_id;
  const idx = queue.findIndex((q) => q.id === projectId);
  const prev = idx > 0 ? queue[idx - 1] : null;
  const next = idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : null;

  return (
    <div>
      <Link href="/review" className="text-sm text-brand font-medium hover:underline">
        ← Needs review
      </Link>

      {error && (
        <div className="pixl-card p-3 mt-4 text-sm font-medium text-rose-600">{error}</div>
      )}
      {!claim.ok && (
        <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Heads up — {claimHandle ?? claim.by ?? "another reviewer"} is already reviewing this
          submission. Avoid double-grading it.
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 pb-24 mt-4">
        {/* main */}
        <div className="flex-1 min-w-0 space-y-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <StatusBadge status={p.status} />
              <LevelBadge level={p.level} />
              <ShipBadges project={p} />
              <span className="text-xs text-ink/40 font-mono ml-auto">#{p.id}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight break-words">{p.name}</h1>
            {p.description && (
              <div
                className="md text-ink/60 mt-2 break-words"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(p.description) }}
              />
            )}
          </div>

          {p.image_url && (
            <img
              src={p.image_url}
              alt=""
              className="w-full max-h-96 object-contain rounded-xl border border-[var(--line)] bg-black/40"
            />
          )}

          {p.system_note && (
            <div className="rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm font-medium text-brand">
              {p.system_note}
            </div>
          )}
          {(() => {
            const aiCommits = commits.commits.filter((c) => c.ai).length;
            if (aiCommits === 0 || p.used_ai) return null;
            return (
              <div className="rounded-xl border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 p-3 text-sm font-medium text-violet-700 dark:text-violet-300">
                {aiCommits} commit{aiCommits === 1 ? "" : "s"} in this repo {aiCommits === 1 ? "is" : "are"} signed
                by an AI tool, but the maker did not tick &ldquo;AI used&rdquo;. Undisclosed AI —
                verify before crediting.
              </div>
            );
          })()}
          {p.is_update && p.update_notes && (
            <div className="rounded-xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 p-4 text-sm">
              <div className="font-semibold mb-1 text-blue-700 dark:text-blue-300">
                What changed since last approval
              </div>
              <div className="whitespace-pre-wrap break-words text-blue-900/90 dark:text-blue-200/90">
                {p.update_notes}
              </div>
            </div>
          )}
          {p.used_ai && (
            <div className="rounded-xl border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 p-4 text-sm">
              <div className="font-semibold mb-1 text-violet-700 dark:text-violet-300">
                AI declaration
              </div>
              <div className="whitespace-pre-wrap break-words text-violet-900/90 dark:text-violet-200/90">
                {p.ai_notes || "Player ticked “AI used” but gave no details (pre-dates the details field)."}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid place-items-center w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-semibold shrink-0">
                {String(ownerName).replace(/^@/, "").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <Link href={`/players/${p.user_id}`} className="font-medium hover:text-brand truncate block">
                  {ownerName}
                </Link>
                {p.users?.slack_id && (
                  <a
                    href={`https://hackclub.slack.com/team/${p.users.slack_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-ink/45 hover:text-brand"
                    title="Open in Slack"
                  >
                    {p.users.slack_id}
                  </a>
                )}
              </div>
            </div>
            {p.repo_url && (
              <a
                href={p.repo_url}
                target="_blank"
                rel="noreferrer"
                className="pixl-btn bg-[var(--surface)] text-ink text-sm"
              >
                Repo ↗
              </a>
            )}
            {p.demo_url && (
              <a
                href={p.demo_url}
                target="_blank"
                rel="noreferrer"
                className="pixl-btn bg-[var(--surface)] text-ink text-sm"
              >
                Live demo ↗
              </a>
            )}
          </div>

          <div className="text-xs text-ink/45">
            Submitted {ago(p.shipped_at)} · {fmtHM(hours)} logged
            {p.hackatime_projects?.length > 0 && (
              <>
                {" · "}
                <a href="#hackatime" className="text-brand hover:underline">
                  hackatime: {p.hackatime_projects.join(", ")}
                </a>
              </>
            )}
          </div>

          <ReviewDetailTabs
            commits={commits}
            journals={journals}
            verdicts={verdicts}
            yswsShips={yswsShips}
            hackatime={hackatimeReport}
          />
        </div>

        {/* sidebar */}
        <aside className="lg:w-80 shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="pixl-card p-5">
              <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">
                Logged hours
              </div>
              <div className="mt-1 mb-3">
                <span className="text-3xl font-bold">{fmtHM(hours)}</span>{" "}
                <span className="text-ink/50 text-sm">logged</span>
              </div>
              <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden flex">
                <div className="h-full bg-[color:var(--color-hc-blue)]" style={{ width: `${htPct}%` }} />
                <div className="h-full bg-[color:var(--color-hc-purple)]" style={{ width: `${100 - htPct}%` }} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <a href="#hackatime" className="flex items-center gap-2 hover:text-brand" title="See the full Hackatime breakdown">
                  <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-hc-blue)]" />
                  <span className="text-ink/70">Hackatime →</span>
                  <span className="ml-auto tabular-nums font-medium">{fmtHM(hackatimeHours)}</span>
                </a>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-hc-purple)]" />
                  <span className="text-ink/70">Journals</span>
                  <span className="ml-auto tabular-nums font-medium">{fmtHM(journalHours)}</span>
                </div>
              </div>
            </div>

            {trust && (
              <div className="pixl-card p-4 flex items-center gap-3">
                <span
                  className={`badge ${
                    trust.level === "green"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : trust.level === "red" || trust.level === "convicted"
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        : trust.level === "yellow" || trust.level === "suspected"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  }`}
                >
                  {trust.level}
                </span>
                <span className="text-xs text-ink/55">
                  Hackatime trust factor — {trust.level === "green"
                    ? "no fraud flags on this account."
                    : trust.level === "red" || trust.level === "convicted"
                      ? "Hackatime has convicted this account of fraud. Do not credit without digging."
                      : trust.level === "yellow" || trust.level === "suspected"
                        ? "Hackatime suspects this account — verify carefully."
                        : "not scored yet."}
                </span>
              </div>
            )}

            {isFinalStage && (
              <div className="pixl-card p-5 border-violet-300 dark:border-violet-500/30">
                <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide mb-2">
                  First pass
                </div>
                <div className="text-sm text-ink/70">
                  Passed by <span className="font-medium text-ink">{p.first_pass_by || "a reviewer"}</span>
                  {p.first_pass_hours != null && <> · credited {p.first_pass_hours}h</>}
                </div>
                {p.first_pass_note && (
                  <p className="mt-2 text-sm whitespace-pre-wrap break-words text-ink/80">
                    {p.first_pass_note}
                  </p>
                )}
              </div>
            )}

            {isOwn && p.status === "shipped" && (
              <div className="pixl-card p-5 text-sm border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300">
                This is your own submission — another reviewer has to do the first pass.
              </div>
            )}
            {isOwn && isFinalStage && canReview && (
              <div className="pixl-card p-4 text-xs border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300">
                Your own submission — someone else first-passed it, so you may finalize. This is
                logged.
              </div>
            )}

            {canReview ? (
              <>
                <div className="pixl-card p-5">
                  <div className="text-sm font-semibold mb-1">
                    {isFinalStage ? "Final pass" : canSecondPass ? "Your verdict" : "First pass"}
                  </div>
                  <p className="text-xs text-ink/55 mb-3">
                    {canSecondPass
                      ? "Approving credits pixels at the player's level rate ($4–7/hr in px) and ships it. Every verdict needs a note. You can only lower the credited hours."
                      : "Every verdict needs a note. Approving sends this to a final reviewer before pixels are credited. You can only lower the credited hours."}
                  </p>
                  <ReviewForm
                    projectId={p.id}
                    repoUrl={p.repo_url}
                    demoUrl={p.demo_url}
                    claimedHours={hours}
                    defaultHours={formDefaultHours}
                    secondPass={canSecondPass}
                    bounties={bounties}
                  />
                </div>

                <details className="pixl-card p-4 border-rose-300 dark:border-rose-500/30">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-rose-700 dark:text-rose-400 select-none list-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                    Ban project — permanent
                  </summary>
                  <p className="text-xs text-ink/55 mt-2">
                    Permanently bans this project — it can never be shipped again and is hidden
                    everywhere. Different from requesting changes. Reversible by staff only.
                  </p>
                  <form action={banProject} className="mt-3 flex flex-col gap-2">
                    <input type="hidden" name="projectId" value={p.id} />
                    <input type="hidden" name="returnTo" value={`/review/${p.id}`} />
                    <textarea
                      name="reason"
                      required
                      rows={2}
                      placeholder="Reason for the ban (shown to the owner)…"
                      className="pixl-input text-sm resize-y"
                    />
                    <button className="pixl-btn bg-rose-800 text-white border-transparent text-sm">
                      Ban project
                    </button>
                  </form>
                </details>
              </>
            ) : isOwn ? null : isFinalStage ? (
              <div className="pixl-card p-5 text-sm text-ink/60">
                Passed the first review — waiting on a final reviewer to sign off before pixels are
                credited.
              </div>
            ) : (
              <div className="pixl-card p-5 text-sm text-ink/60">
                Already reviewed —{" "}
                <StatusBadge status={p.status} />. See the{" "}
                <Link href={`/projects/${p.id}`} className="text-brand hover:underline">
                  project page
                </Link>{" "}
                to revert or take further action.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* sticky nav bar */}
      <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 border-t border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur flex items-center gap-4">
        <Link
          href={prev ? `/review/${prev.id}` : "#"}
          prefetch={false}
          className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
            prev ? "" : "pointer-events-none opacity-40"
          }`}
        >
          ← Prev
        </Link>
        <div className="flex-1 text-center text-sm text-ink/55 tabular-nums">
          {idx >= 0 ? `Submission ${idx + 1} of ${queue.length}` : "Not in queue"}
        </div>
        <Link
          href={next ? `/review/${next.id}` : "#"}
          prefetch={false}
          className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
            next ? "" : "pointer-events-none opacity-40"
          }`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
