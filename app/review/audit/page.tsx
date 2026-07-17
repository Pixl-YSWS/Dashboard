import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { listReviewAudits, countPendingReviews } from "@/lib/db";
import { ReviewTabs } from "@/app/_components/ReviewTabs";

export const dynamic = "force-dynamic";

const VERDICT_BADGE: Record<string, string> = {
  approved: "bg-mint/30 dark:bg-mint/20",
  first_pass_approved: "bg-parch",
  needs_changes: "bg-tang/20 text-tang",
  reverted: "bg-brand/15 text-brand",
};

export default async function AuditNotesPage() {
  const access = await requirePagePerm(["review"]);
  if (!access.isSuper) redirect("/review");
  const [audits, pending] = await Promise.all([listReviewAudits(200), countPendingReviews()]);
  const withNotes = audits.filter((a) => a.audit_note && a.audit_note.trim() !== "");

  return (
    <div>
      <ReviewTabs isSuper={access.isSuper} pending={pending} />
      <p className="text-sm text-ink/55 mb-4 max-w-2xl">
        Internal notes reviewers write with every verdict. Players never see these — they&apos;re
        for audits and fraud checks.
      </p>
      {withNotes.length === 0 ? (
        <div className="pixl-card p-8 text-center text-ink/55 text-sm">
          No audit notes yet — they&apos;ll appear as reviews come in.
        </div>
      ) : (
        <div className="space-y-4">
          {withNotes.map((a) => (
            <div key={a.id} className="pixl-card p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/projects/${a.project_id}`}
                  className="font-semibold hover:text-brand"
                >
                  {a.project_name}
                </Link>
                <span className={`badge ${VERDICT_BADGE[a.verdict] ?? "bg-parch"}`}>
                  {a.verdict.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-ink/50">
                  by {a.reviewer.replace(/\s*\([^)]*\)\s*$/, "")} · player{" "}
                  <Link href={`/players/${a.user_id}`} className="hover:text-brand">
                    {a.player_name}
                  </Link>
                </span>
                <span className="text-xs text-ink/45 ml-auto">
                  {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-ink/80 mt-3 whitespace-pre-wrap">{a.audit_note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
