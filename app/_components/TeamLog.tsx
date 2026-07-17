import { listTeamLog, type TeamLogRow } from "@/lib/db";
import { undoTeamChange } from "@/app/actions";

function describe(row: TeamLogRow): string {
  const before = row.before ?? [];
  const after = row.after ?? [];
  const fmt = (p: string[]) => {
    const shown = p.filter((x) => x !== "no_review");
    const base = shown.length > 0 ? shown.join(", ") : "nothing";
    return p.includes("no_review") ? `${base} (review blocked)` : base;
  };
  switch (row.action) {
    case "added":
      return `added to the team with ${fmt(after)}`;
    case "removed":
      return after.length > 0
        ? `removed (kept ${fmt(after)})`
        : `removed from the team (had ${fmt(before)})`;
    case "updated":
      return `permissions changed: ${fmt(before)} → ${fmt(after)}`;
    case "undo":
      return `change undone: ${fmt(before)} → ${fmt(after)}`;
    default:
      return `${row.action}: ${fmt(before)} → ${fmt(after)}`;
  }
}

const ACTION_BADGE: Record<string, string> = {
  added: "bg-mint/30 dark:bg-mint/20",
  removed: "bg-brand/15 text-brand",
  updated: "bg-parch",
  undo: "bg-tang/20 text-tang",
};

export async function TeamLog() {
  const rows = await listTeamLog(20);
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-medium text-ink/60 mb-3">Team log</div>
      <div className="pixl-card divide-y divide-[var(--line)]">
        {rows.map((row) => (
          <div key={row.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm">
                <span className="font-semibold">{row.name || row.slack_id}</span>{" "}
                <span className={`badge ${ACTION_BADGE[row.action] ?? "bg-parch"} text-[0.65rem] uppercase tracking-wide align-middle mx-1`}>
                  {row.action}
                </span>
                <span className="text-ink/70">{describe(row)}</span>
              </div>
              <div className="text-xs text-ink/45 mt-0.5 truncate">
                by {row.actor || "unknown"} ·{" "}
                {new Date(row.created_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            {row.action !== "undo" && (
              <form action={undoTeamChange} className="shrink-0">
                <input type="hidden" name="id" value={row.id} />
                <button className="pixl-btn bg-[var(--surface)] text-ink text-sm">Undo</button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
