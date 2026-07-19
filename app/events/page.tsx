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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = "force-dynamic";

function status(ev: DashEventRow): "live" | "upcoming" | "ended" | "stopped" {
  const now = new Date().toISOString();
  if (ev.stopped_at) return "stopped";
  if (ev.starts_at > now) return "upcoming";
  if (ev.ends_at <= now) return "ended";
  return "live";
}

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  live: "success",
  upcoming: "secondary",
  ended: "secondary",
  stopped: "destructive",
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
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Events</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Weekend events players see in-game the moment they go live. All times are UTC. Bonus
          math runs server-side — nothing here hands out free pixels.
        </p>
      </div>

      {created && (
        <Alert>
          <AlertDescription className="font-medium text-emerald-600 dark:text-emerald-400">
            Event created.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="font-medium text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-5 md:p-6 gap-0">
        <div className="text-base font-semibold mb-1">Start an event</div>
        <p className="text-xs text-muted-foreground mb-4">
          Fill only the fields your event type uses — the rest are ignored.
        </p>
        <form action={createEvent} className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="block">
              <Label className="block text-sm font-medium mb-1.5">Type</Label>
              <Select name="type" defaultValue={Object.keys(EVENT_TYPES)[0]}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Name (players see this)</span>
              <Input
                name="name"
                required
                maxLength={100}
                placeholder="e.g. Double Streak Weekend"
                className="w-full text-sm"
              />
            </Label>
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Starts (UTC, blank = now)</span>
              <Input name="startsAt" type="datetime-local" className="w-full text-sm" />
            </Label>
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Ends (UTC)</span>
              <Input name="endsAt" type="datetime-local" required className="w-full text-sm" />
            </Label>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Bounty reward (px)</span>
              <Input name="reward" type="number" min={0} max={500} placeholder="50" className="w-full text-sm" />
            </Label>
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Bounty description</span>
              <Input
                name="description"
                maxLength={500}
                placeholder="e.g. ship something multiplayer"
                className="w-full text-sm"
              />
            </Label>
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Goal: ships target / bonus %</span>
              <div className="flex gap-2">
                <Input name="target" type="number" min={0} placeholder="25" className="w-full text-sm" />
                <Input name="bonusPct" type="number" min={0} max={50} placeholder="10" className="w-full text-sm" />
              </div>
            </Label>
            <Label className="block font-normal">
              <span className="block text-sm font-medium mb-1.5">Blitz multiplier</span>
              <Input name="mult" type="number" step="0.1" min={1} max={3} placeholder="1.5" className="w-full text-sm" />
            </Label>
          </div>
          {shopItems.length > 0 && (
            <div>
              <span className="block text-sm font-medium mb-1.5">
                Mystery merchant items (keep them inactive in the shop — they only show while the
                event runs)
              </span>
              <div className="flex flex-wrap gap-3">
                {shopItems.map((i) => (
                  <Label
                    key={i.id}
                    className={`flex items-center gap-2 text-sm font-normal rounded-lg border border-border px-3 py-1.5 ${
                      i.active ? "opacity-60" : ""
                    }`}
                  >
                    <Checkbox name="itemIds" value={String(i.id)} />
                    {i.name}
                    {i.active && <span className="text-xs text-muted-foreground">(active anyway)</span>}
                  </Label>
                ))}
              </div>
            </div>
          )}
          <Button className="bg-brand text-white border-transparent">Create event</Button>
        </form>
      </Card>

      <div>
        <div className="text-sm font-medium text-muted-foreground mb-3">All events</div>
        <div className="space-y-3">
          {events.map((ev) => {
            const st = status(ev);
            return (
              <Card key={ev.id} className="p-4 gap-0 flex-row items-start justify-between flex-wrap">
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-2 flex-wrap">
                    {ev.name}
                    <Badge variant="secondary" className="text-[0.65rem] uppercase tracking-wide">
                      {EVENT_TYPES[ev.type] ?? ev.type}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[st]} className="text-[0.65rem] uppercase tracking-wide">
                      {st}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{configSummary(ev)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmt(ev.starts_at)} → {fmt(ev.ends_at)} UTC
                    {ev.created_by ? ` · by ${ev.created_by.replace(/\s*\([^)]*\)\s*$/, "")}` : ""}
                  </div>
                  {ev.type === "community_goal" && progress.has(ev.id) && (
                    <div className="mt-2 max-w-sm">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>
                          {progress.get(ev.id)} / {Number(ev.config.target) || 0} ships
                        </span>
                        <span>
                          {(progress.get(ev.id) ?? 0) >= (Number(ev.config.target) || Infinity)
                            ? "GOAL HIT 🎉"
                            : `+${Number(ev.config.bonusPct) || 0}% if hit`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
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
                    <div className="text-xs text-muted-foreground mt-1">
                      {claims.get(ev.id) ?? 0} project{(claims.get(ev.id) ?? 0) === 1 ? "" : "s"} claimed it
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(st === "live" || st === "upcoming") && (
                    <form action={stopEvent}>
                      <input type="hidden" name="id" value={ev.id} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        Stop
                      </Button>
                    </form>
                  )}
                  {st !== "live" && (
                    <form action={deleteEvent}>
                      <input type="hidden" name="id" value={ev.id} />
                      <Button variant="ghost" size="sm" className="text-muted-foreground">Delete</Button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
          {events.length === 0 && (
            <Card className="p-5 text-muted-foreground text-sm">
              No events yet. Start one above — players see it in-game instantly.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
