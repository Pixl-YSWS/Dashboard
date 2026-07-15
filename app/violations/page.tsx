import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listViolations } from "@/lib/db";
import { slackHandles } from "@/lib/slack";
import { BanForm, WarnForm } from "@/app/_components/Moderate";

export const dynamic = "force-dynamic";

const PER = 20;

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; page?: string }>;
}) {
  await requirePagePerm(["warn", "ban"]);
  const { kind, q, page } = await searchParams;
  const all = await listViolations(500);

  const chatCount = all.filter((v) => v.kind === "chat").length;
  const nameCount = all.length - chatCount;

  const query = (q ?? "").trim().toLowerCase();
  let rows = all;
  if (kind === "chat") rows = rows.filter((v) => v.kind === "chat");
  else if (kind === "name") rows = rows.filter((v) => v.kind !== "chat");
  if (query)
    rows = rows.filter(
      (v) =>
        (v.users?.display_name ?? "").toLowerCase().includes(query) ||
        (v.content ?? "").toLowerCase().includes(query),
    );

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const slice = rows.slice(start, start + PER);
  const handles = await slackHandles(slice.map((v) => v.users?.slack_id));

  const filters = [
    { key: "all", label: "All", count: all.length },
    { key: "chat", label: "Chat", count: chatCount },
    { key: "name", label: "Display names", count: nameCount },
  ];
  const activeKind = kind === "chat" || kind === "name" ? kind : "all";
  const withParams = (over: Record<string, string>) => {
    const k = over.kind ?? activeKind;
    const p = new URLSearchParams();
    if (k !== "all") p.set("kind", k);
    const qq = over.q ?? q;
    if (qq) p.set("q", qq);
    if (over.page && over.page !== "1") p.set("page", over.page);
    const s = p.toString();
    return s ? `/violations?${s}` : "/violations";
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-1">Violations</h1>
      <p className="text-sm text-ink/55 mb-5">
        Every censored chat message and rejected display name, newest first.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="inline-flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface)]">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={withParams({ kind: f.key })}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeKind === f.key
                  ? "bg-ink text-white"
                  : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {f.label}
              <span className="text-[0.7rem] opacity-70">{f.count}</span>
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          {activeKind !== "all" && <input type="hidden" name="kind" value={activeKind} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search player or text…"
            className="pixl-input text-sm min-w-0 w-56"
          />
          <button className="pixl-btn bg-ink text-white text-sm">Search</button>
        </form>
      </div>

      <div className="pixl-card divide-y divide-[var(--line)]">
        {slice.length === 0 && (
          <div className="p-6 text-ink/50 text-sm text-center">No violations match.</div>
        )}
        {slice.map((v) => {
          const handle =
            (v.users?.slack_id && handles.get(v.users.slack_id)) ??
            v.users?.display_name ??
            v.user_id;
          return (
            <div key={v.id} className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`badge ${
                    v.kind === "chat"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                  }`}
                >
                  {v.kind === "chat" ? "chat" : v.kind}
                </span>
                <Link href={`/players/${v.user_id}`} className="font-medium hover:text-brand">
                  {handle}
                </Link>
                {!v.users?.slack_id && (
                  <span className="text-xs text-ink/40">(no slack id — can&apos;t DM)</span>
                )}
                <span className="text-xs text-ink/45 ml-auto">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-sm bg-[var(--surface-2)] border border-[var(--line)] rounded-lg px-3 py-1.5 my-2 break-words">
                {v.content}
              </div>
              <div className="flex gap-3 flex-wrap">
                <WarnForm userId={v.user_id} compact />
                <BanForm userId={v.user_id} compact />
              </div>
            </div>
          );
        })}
      </div>

      {total > PER && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
          <span className="text-ink/50">
            Showing {start + 1}–{Math.min(start + PER, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={withParams({ page: String(cur - 1) })}
              className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
                cur <= 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              ←
            </Link>
            <span className="text-ink/60 tabular-nums px-1">
              {cur} / {pages}
            </span>
            <Link
              href={withParams({ page: String(cur + 1) })}
              className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
                cur >= pages ? "pointer-events-none opacity-40" : ""
              }`}
            >
              →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
