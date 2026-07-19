import { Bar, CardSkeleton } from "@/app/_components/Loading";

// The review detail page is the slowest (GitHub commits, Hackatime spans, YSWS
// archive). This skeleton mirrors its layout so a reviewer sees the shape of
// the page immediately while the analysis loads.
export default function Loading() {
  return (
    <div>
      <div className="text-sm text-ink/40">← Needs review</div>
      <div className="flex flex-col lg:flex-row gap-6 pb-24 mt-4">
        <div className="flex-1 min-w-0 space-y-5">
          <div className="space-y-3">
            <Bar w="180px" />
            <div className="h-9 w-2/3 rounded bg-[var(--surface-2)] animate-pulse" />
            <Bar w="90%" />
          </div>
          <div className="h-56 w-full rounded-xl bg-[var(--surface-2)] animate-pulse" />
          <div className="pixl-card p-1.5 flex gap-1">
            {["Commits", "Journals", "Past reviews", "Other YSWS"].map((t) => (
              <span key={t} className="px-3 py-1.5 text-sm text-ink/35">{t}</span>
            ))}
          </div>
          <CardSkeleton lines={4} />
        </div>
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    </div>
  );
}
