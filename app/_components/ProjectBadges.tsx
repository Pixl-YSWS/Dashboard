const TONES = {
  gray: "bg-black/[0.05] text-ink/70 dark:bg-white/[0.08]",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

const STATUS: Record<string, { label: string; tone: keyof typeof TONES; dot: string }> = {
  draft: { label: "Draft", tone: "gray", dot: "bg-gray-400" },
  shipped: { label: "In review", tone: "amber", dot: "bg-amber-500" },
  second_review: { label: "Final review", tone: "violet", dot: "bg-violet-500" },
  approved: { label: "Approved", tone: "green", dot: "bg-emerald-500" },
  needs_changes: { label: "Needs changes", tone: "rose", dot: "bg-rose-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "gray" as const, dot: "bg-gray-400" };
  return (
    <Badge tone={s.tone}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </Badge>
  );
}

const LEVEL_NAMES = ["Greenhorn", "Deputy", "Outlaw", "Legend"];

export function LevelBadge({ level }: { level: number }) {
  const idx = Math.min(Math.max(Math.round(level) || 1, 1), 4);
  return (
    <Badge tone="blue">
      L{idx} · {LEVEL_NAMES[idx - 1]}
    </Badge>
  );
}

export function ShipBadges({
  project,
}: {
  project: { is_update: boolean; used_ai: boolean; other_ysws: boolean };
}) {
  return (
    <>
      {project.is_update && <Badge tone="blue">Update</Badge>}
      {project.used_ai && <Badge tone="violet">AI used</Badge>}
      {project.other_ysws && <Badge tone="amber">Other YSWS disclosed</Badge>}
    </>
  );
}
