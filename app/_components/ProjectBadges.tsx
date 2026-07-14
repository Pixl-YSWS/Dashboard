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
