// Shared loading UI. Rendered by Next.js loading.tsx boundaries the instant a
// navigation starts, so slow server components (the review page fetches
// GitHub / Hackatime / YSWS) show feedback immediately instead of a frozen tab.

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink/50">
      <span className="inline-block w-7 h-7 rounded-full border-[3px] border-[var(--line-strong)] border-t-brand animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Bar({ w = "100%" }: { w?: string }) {
  return (
    <span
      className="block h-4 rounded bg-[var(--surface-2)] animate-pulse"
      style={{ width: w }}
    />
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="pixl-card p-4 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} w={`${90 - i * 15}%`} />
      ))}
    </div>
  );
}
