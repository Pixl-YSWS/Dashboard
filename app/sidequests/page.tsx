import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { listSidequests } from "@/lib/db";
import { addSidequest, toggleSidequest, deleteSidequest } from "@/app/actions";
import { PendingButton } from "@/app/_components/PendingButton";

export const dynamic = "force-dynamic";

export default async function SidequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const { error, created } = await searchParams;
  const quests = await listSidequests();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Sidequests</h1>
        <p className="text-sm text-ink/55 mt-1 max-w-2xl">
          The quest log every player sees in-game (J key). Players will unlock quests by
          talking to the NPC you name here — the unlock wiring comes with the NPC work;
          for now this is the master list.
        </p>
      </div>

      {created && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 p-3 text-sm font-medium">
          Sidequest added.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 p-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="pixl-card p-5 md:p-6">
        <div className="text-base font-semibold mb-4">Add a sidequest</div>
        <form action={addSidequest} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Name</span>
              <input
                name="name"
                required
                maxLength={80}
                placeholder="e.g. Secure the Cyberpunk City network"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Region</span>
              <input
                name="region"
                maxLength={40}
                placeholder="e.g. Cyberpunk City"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">NPC who gives it</span>
              <input
                name="npc"
                maxLength={40}
                placeholder="e.g. The Netrunner"
                className="pixl-input w-full text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Description (what to build)</span>
            <input
              name="description"
              maxLength={500}
              placeholder="Build a security tool or CTF-style challenge…"
              className="pixl-input w-full text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Reward (shown to players)</span>
            <input
              name="reward"
              maxLength={120}
              placeholder="e.g. Flipper Zero"
              className="pixl-input w-full text-sm"
            />
          </label>
          <PendingButton className="pixl-btn bg-brand text-white border-transparent" pendingText="Adding…">
            Add sidequest
          </PendingButton>
        </form>
      </div>

      <div className="space-y-3">
        {quests.map((q) => (
          <div
            key={q.id}
            className={`pixl-card p-4 flex items-start justify-between gap-4 flex-wrap ${
              q.active ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-2 flex-wrap">
                {q.name}
                {q.region && <span className="badge bg-parch">{q.region}</span>}
                {!q.active && <span className="badge bg-parch">hidden</span>}
              </div>
              {q.description && <div className="text-sm text-ink/60 mt-1">{q.description}</div>}
              <div className="text-xs text-ink/45 mt-1">
                {q.npc ? `given by ${q.npc}` : "no NPC set"}
                {q.reward ? ` · reward: ${q.reward}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <form action={toggleSidequest}>
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="active" value={q.active ? "0" : "1"} />
                <button className="pixl-btn bg-[var(--surface)] text-ink text-sm">
                  {q.active ? "Hide" : "Show"}
                </button>
              </form>
              <form action={deleteSidequest}>
                <input type="hidden" name="id" value={q.id} />
                <button className="pixl-btn bg-transparent text-rose-600 border-rose-200 dark:border-rose-500/30 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
        {quests.length === 0 && (
          <div className="pixl-card p-8 text-center text-ink/55 text-sm">
            No sidequests yet — the landing page&apos;s sidequest rewards are good seeds.
          </div>
        )}
      </div>
    </div>
  );
}
