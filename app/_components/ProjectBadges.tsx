const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "draft", className: "bg-ink/10" },
  shipped: { label: "in review", className: "bg-tang/30 dark:bg-tang/40" },
  approved: { label: "approved", className: "bg-mint/40 dark:bg-mint/30" },
  needs_changes: { label: "needs changes", className: "bg-brand/15 dark:bg-brand/30" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, className: "bg-ink/10" };
  return (
    <span
      className={`font-pixel text-sm px-2 py-0.5 border-2 border-ink whitespace-nowrap ${s.className}`}
    >
      {s.label}
    </span>
  );
}

const LEVEL_NAMES = ["Greenhorn", "Deputy", "Outlaw", "Legend"];

export function LevelBadge({ level }: { level: number }) {
  const idx = Math.min(Math.max(Math.round(level) || 1, 1), 4);
  return (
    <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-parch whitespace-nowrap">
      L{idx} · {LEVEL_NAMES[idx - 1]}
    </span>
  );
}

export function ShipBadges({
  project,
}: {
  project: { is_update: boolean; used_ai: boolean; other_ysws: boolean };
}) {
  return (
    <>
      {project.is_update && (
        <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-blue-600/20 dark:bg-blue-600/30 whitespace-nowrap">
          update
        </span>
      )}
      {project.used_ai && (
        <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-purple-600/20 dark:bg-purple-600/30 whitespace-nowrap">
          AI used
        </span>
      )}
      {project.other_ysws && (
        <span className="font-pixel text-sm px-2 py-0.5 border-2 border-ink bg-tang/30 dark:bg-tang/40 whitespace-nowrap">
          other YSWS disclosed
        </span>
      )}
    </>
  );
}
