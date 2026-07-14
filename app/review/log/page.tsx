import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { listReviewAudits } from "@/lib/db";
import { ReviewTabs } from "@/app/_components/ReviewTabs";

export const dynamic = "force-dynamic";

function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

export default async function ReviewLogPage() {
  const access = await requirePagePerm(["review"]);
  if (!access.isSuper) redirect("/review");
  const log = await listReviewAudits();

  return (
    <div>
      <h1 className="font-pixel text-4xl md:text-5xl text-brand mb-3">Review log</h1>
      <ReviewTabs isSuper={access.isSuper} />
      <p className="text-sm text-ink/60 mb-4">
        Owners only — every verdict with whether the reviewer opened the repo and
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
                  : r.verdict === "reverted"
                    ? "bg-blue-600/20 dark:bg-blue-600/30"
                    : "bg-brand/15 dark:bg-brand/30"
              }`}
            >
              {r.verdict === "approved"
                ? "approved"
                : r.verdict === "reverted"
                  ? "reverted"
                  : "sent back"}
            </span>
            <div className="flex-1 min-w-48">
              <span className="font-bold">{r.reviewer}</span>
              {" → "}
              <Link href={`/players/${r.user_id}`} className="font-bold hover:text-brand">
                {r.player_name}
              </Link>
              {" · "}
              <Link href={`/projects/${r.project_id}`} className="font-bold hover:text-brand">
                {r.project_name}
              </Link>
              <div className="text-ink/70 break-words">{r.note}</div>
              {r.verdict !== "reverted" && (
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
              )}
            </div>
            <div className="text-xs text-ink/50 shrink-0">
              {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
