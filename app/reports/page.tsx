import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listReports } from "@/lib/db";
import { resolveReport } from "@/app/actions";
import { slackHandles } from "@/lib/slack";
import { BanForm, WarnForm } from "@/app/_components/Moderate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";

export const dynamic = "force-dynamic";

const PER = 20;

const STATUS_BADGE: Record<string, "warning" | "default" | "destructive"> = {
  open: "warning",
  resolved: "default",
  dismissed: "destructive",
};

function initialsOf(name: string): string {
  return (
    (name || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requirePagePerm(["warn", "ban"]);
  const { status, page } = await searchParams;
  const all = await listReports(500);

  const openCount = all.filter((r) => r.status === "open").length;
  const activeStatus =
    status === "resolved" || status === "dismissed" || status === "all" ? status : "open";
  const rows = activeStatus === "all" ? all : all.filter((r) => r.status === activeStatus);

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const slice = rows.slice(start, start + PER);
  const handles = await slackHandles(slice.map((r) => r.target_slack));

  const filters = [
    { key: "open", label: "Open", count: openCount },
    { key: "resolved", label: "Resolved" },
    { key: "dismissed", label: "Dismissed" },
    { key: "all", label: "All", count: all.length },
  ];

  const withParams = (over: { status?: string; page?: number }) => {
    const s = over.status ?? activeStatus;
    const p = new URLSearchParams();
    if (s !== "open") p.set("status", s);
    if (over.page && over.page !== 1) p.set("page", String(over.page));
    const q = p.toString();
    return q ? `/reports?${q}` : "/reports";
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">Reports</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Players flagged by other players. Chat isn&apos;t stored, so each report carries a snapshot
        of the recent chat the reporter had on screen.
      </p>

      <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-card mb-4">
        {filters.map((f) => (
          <Button
            key={f.key}
            asChild
            variant="ghost"
            size="sm"
            className={
              activeStatus === f.key
                ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : ""
            }
          >
            <Link href={withParams({ status: f.key })}>
              {f.label}
              {typeof f.count === "number" ? ` (${f.count})` : ""}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {slice.length === 0 && (
          <Card className="p-6 text-muted-foreground text-sm text-center">
            No reports here.
          </Card>
        )}
        {slice.map((r) => {
          const handle = (r.target_slack && handles.get(r.target_slack)) ?? null;
          return (
            <Card key={r.id} className="p-4 gap-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-destructive/15 text-destructive text-xs font-semibold shrink-0">
                  {initialsOf(r.target_name)}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/players/${r.target_id}`}
                    className="font-medium hover:text-brand block truncate"
                  >
                    {r.target_name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {handle ? `${handle} · ` : ""}
                    {!r.target_slack && "no slack · "}
                    reported by{" "}
                    <Link href={`/players/${r.reporter_id}`} className="hover:text-brand">
                      {r.reporter_name}
                    </Link>{" "}
                    · {new Date(r.created_at).toLocaleString()}
                    {r.scene ? ` · in ${r.scene}` : ""}
                  </span>
                </div>
                <Badge variant={STATUS_BADGE[r.status] ?? "default"} className="ml-auto capitalize">
                  {r.status}
                </Badge>
              </div>

              {r.reason && (
                <div className="text-sm bg-muted border border-border rounded-lg px-3 py-2 mt-3 break-words">
                  {r.reason}
                </div>
              )}

              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground select-none">
                  Chat context ({r.context.length})
                </summary>
                {r.context.length === 0 ? (
                  <div className="text-xs text-muted-foreground mt-2">No chat context was attached.</div>
                ) : (
                  <div className="mt-2 rounded-lg border border-border bg-background/60 divide-y divide-border">
                    {r.context.map((c, i) => (
                      <div key={i} className="px-3 py-1.5 text-sm break-words">
                        <span
                          className={`font-medium ${
                            c.name === r.target_name ? "text-destructive" : "text-foreground/70"
                          }`}
                        >
                          {c.name}
                        </span>
                        <span className="text-muted-foreground">: </span>
                        {c.text}
                      </div>
                    ))}
                  </div>
                )}
              </details>

              {r.status !== "open" && r.handled_by && (
                <div className="text-xs text-muted-foreground mt-3">
                  Handled by {r.handled_by}
                  {r.handled_at ? ` · ${new Date(r.handled_at).toLocaleString()}` : ""}
                </div>
              )}

              <div className="flex gap-3 flex-wrap items-center mt-3 pt-3 border-t border-border">
                <WarnForm userId={r.target_id} compact />
                <BanForm userId={r.target_id} compact />
                {r.status === "open" && (
                  <div className="flex gap-2 ml-auto">
                    <form action={resolveReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="action" value="resolve" />
                      <Button type="submit" size="sm" variant="outline">
                        Mark resolved
                      </Button>
                    </form>
                    <form action={resolveReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="action" value="dismiss" />
                      <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">
                        Dismiss
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {total > PER && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
          <span className="text-muted-foreground">
            Showing {start + 1}–{Math.min(start + PER, total)} of {total}
          </span>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  href={withParams({ page: cur - 1 })}
                  aria-label="Previous page"
                  className={cur <= 1 ? "pointer-events-none opacity-40" : ""}
                >
                  ←
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 text-muted-foreground tabular-nums">
                  {cur} / {pages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink
                  href={withParams({ page: cur + 1 })}
                  aria-label="Next page"
                  className={cur >= pages ? "pointer-events-none opacity-40" : ""}
                >
                  →
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
