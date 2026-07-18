import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import {
  listEvents,
  listShopItems,
  communityGoalShipCount,
  bountyClaimCount,
  EVENT_TYPES,
  type DashEventRow,
} from "@/lib/db";
import { createEvent, stopEvent, deleteEvent } from "@/app/actions";

export const dynamic = "force-dynamic";

function status(ev: DashEventRow): "live" | "upcoming" | "ended" | "stopped" {
  const now = new Date().toISOString();
  if (ev.stopped_at) return "stopped";
  if (ev.starts_at > now) return "upcoming";
  if (ev.ends_at <= now) return "ended";
  return "live";
}

const STATUS_BADGE: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  upcoming: "bg-parch",
  ended: "bg-parch text-ink/50",
  stopped: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function configSummary(ev: DashEventRow): string {
  const c = ev.config;
  switch (ev.type) {
    case "double_streak":
      return `streak days count ×${Number(c.perDay) || 2}`;
    case "bounty":
      return `+${Number(c.reward) || 0} px per project${c.description ? ` — ${c.description}` : ""}`;
    case "community_goal":
      return `${Number(c.target) || 0} ships → +${Number(c.bonusPct) || 0}% for every shipper`;
    case "mystery_merchant":
      return `items ${(Array.isArray(c.itemIds) ? c.itemIds : []).join(", ")}`;
    case "review_blitz":
      return `reviewer payouts ×${Number(c.mult) || 1}`;
    default:
      return "window-only leaderboard in the explore menu";
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const { error, created } = await searchParams;

  const [events, shopItems] = await Promise.all([listEvents(), listShopItems()]);
  const progress = new Map<number, number>();
  const claims = new Map<number, number>();
  for (const ev of events) {
    if (ev.type === "community_goal" && status(ev) !== "upcoming")
      progress.set(ev.id, await communityGoalShipCount(ev));
    if (ev.type === "bounty") claims.set(ev.id, await bountyClaimCount(ev.id));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink tracking-tight">Events</h1>
        <p className="text-sm text-ink/55 mt-1 max-w-2xl">
          Weekend events players see in-game the moment they go live. All times are UTC. Bonus
          math runs server-side — nothing here hands out free pixels.
        </p>
      </div>

      {created && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 p-3 text-sm font-medium">
          Event created.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 p-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="pixl-card p-5 md:p-6">
        <div className="text-base font-semibold mb-1">Start an event</div>
        <p className="text-xs text-ink/50 mb-4">
          Fill only the fields your event type uses — the rest are ignored.
        </p>
        <form action={createEvent} className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Type</span>
              <select name="type" className="pixl-input w-full text-sm">
                {Object.entries(EVENT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Name (players see this)</span>
              <input
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Double Streak Weekend"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Starts (UTC, blank = now)</span>
              <input name="startsAt" type="datetime-local" className="pixl-input w-full text-sm" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Ends (UTC)</span>
              <input name="endsAt" type="datetime-local" required className="pixl-input w-full text-sm" />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Bounty reward (px)</span>
              <input name="reward" type="number" min={0} max={500} placeholder="50" className="pixl-input w-full text-sm" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Bounty description</span>
              <input
                name="description"
                maxLength={500}
                placeholder="e.g. ship something multiplayer"
                className="pixl-input w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Goal: ships target / bonus %</span>
              <div className="flex gap-2">
                <input name="target" type="number" min={0} placeholder="25" className="pixl-input w-full text-sm" />
                <input name="bonusPct" type="number" min={0} max={50} placeholder="10" className="pixl-input w-full text-sm" />
              </div>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Blitz multiplier / streak ×per-day</span>
              <div className="flex gap-2">
                <input name="mult" type="number" step="0.1" min={1} max={3} placeholder="1.5" className="pixl-input w-full text-sm" />
                <input name="perDay" type="number" min={2} max={5} placeholder="2" className="pixl-input w-full text-sm" />
              </div>
            </label>
          </div>
          {shopItems.length > 0 && (
            <div>
              <span className="block text-sm font-medium mb-1.5">
                Mystery merchant items (keep them inactive in the shop — they only show while the
                event runs)
              </span>
              <div className="flex flex-wrap gap-3">
                {shopItems.map((i) => (
                  <label
                    key={i.id}
                    className={`flex items-center gap-2 text-sm rounded-lg border border-[var(--line)] px-3 py-1.5 ${
                      i.active ? "opacity-60" : ""
                    }`}
                  >
                    <input type="checkbox" name="itemIds" value={i.id} className="w-4 h-4" />
                    {i.name}
                    {i.active && <span className="text-xs text-ink/45">(active anyway)</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="pixl-btn bg-brand text-white border-transparent">Create event</button>
        </form>
      </div>

      <div>
        <div className="text-sm font-medium text-ink/60 mb-3">All events</div>
        <div className="space-y-3">
          {events.map((ev) => {
            const st = status(ev);
            return (
              <div key={ev.id} className="pixl-card p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    {ev.name}
                    <span className="badge bg-parch text-[0.65rem] uppercase tracking-wide">
                      {EVENT_TYPES[ev.type] ?? ev.type}
                    </span>
                    <span className={`badge text-[0.65rem] uppercase tracking-wide ${STATUS_BADGE[st]}`}>
                      {st}
                    </span>
                  </div>
                  <div className="text-sm text-ink/60 mt-1">{configSummary(ev)}</div>
                  <div className="text-xs text-ink/45 mt-1">
                    {fmt(ev.starts_at)} → {fmt(ev.ends_at)} UTC
                    {ev.created_by ? ` · by ${ev.created_by.replace(/\s*\([^)]*\)\s*$/, "")}` : ""}
                  </div>
                  {ev.type === "community_goal" && progress.has(ev.id) && (
                    <div className="mt-2 max-w-sm">
                      <div className="flex justify-between text-xs text-ink/60 mb-1">
                        <span>
                          {progress.get(ev.id)} / {Number(ev.config.target) || 0} ships
                        </span>
                        <span>
                          {(progress.get(ev.id) ?? 0) >= (Number(ev.config.target) || Infinity)
                            ? "GOAL HIT 🎉"
                            : `+${Number(ev.config.bonusPct) || 0}% if hit`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((progress.get(ev.id) ?? 0) / (Number(ev.config.target) || 1)) * 100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {ev.type === "bounty" && (
                    <div className="text-xs text-ink/60 mt-1">
                      {claims.get(ev.id) ?? 0} project{(claims.get(ev.id) ?? 0) === 1 ? "" : "s"} claimed it
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(st === "live" || st === "upcoming") && (
                    <form action={stopEvent}>
                      <input type="hidden" name="id" value={ev.id} />
                      <button className="pixl-btn bg-transparent text-rose-600 border-rose-200 dark:border-rose-500/30 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        Stop
                      </button>
                    </form>
                  )}
                  {st !== "live" && (
                    <form action={deleteEvent}>
                      <input type="hidden" name="id" value={ev.id} />
                      <button className="pixl-btn bg-transparent text-ink/50 text-sm">Delete</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="pixl-card p-5 text-ink/50 text-sm">
              No events yet. Start one above — players see it in-game instantly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
