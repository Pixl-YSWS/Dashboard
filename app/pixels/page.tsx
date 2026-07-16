import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listPixelTransactions } from "@/lib/db";
import { PixelAdjustForm } from "@/app/_components/PixelAdjustForm";

export const dynamic = "force-dynamic";

const PER = 25;

const REASON_LABEL: Record<string, string> = {
  project_approved: "Project approved",
  review_reverted: "Verdict reverted",
  manual_deduction: "Manual deduction",
  manual_grant: "Manual grant",
};

function fmt(n: number): string {
  return String(Math.round(n));
}

export default async function PixelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    filter?: string;
    user?: string;
    error?: string;
    adjusted?: string;
  }>;
}) {
  const access = await requirePagePerm(["review"]);
  const { page, filter, user, error, adjusted } = await searchParams;
  const all = await listPixelTransactions(1000);

  const issued = all.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = all.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const net = issued + spent;

  const activeFilter = filter === "given" || filter === "spent" ? filter : "all";
  let rows = all;
  if (activeFilter === "given") rows = rows.filter((t) => t.amount > 0);
  else if (activeFilter === "spent") rows = rows.filter((t) => t.amount < 0);
  if (user) rows = rows.filter((t) => t.user_id === user);
  const userName = user ? (rows[0]?.player_name ?? "player") : null;

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const slice = rows.slice(start, start + PER);

  const qp = (over: { page?: number; filter?: string }) => {
    const p = new URLSearchParams();
    const f = over.filter ?? activeFilter;
    if (f !== "all") p.set("filter", f);
    if (user) p.set("user", user);
    if (over.page && over.page !== 1) p.set("page", String(over.page));
    const s = p.toString();
    return s ? `/pixels?${s}` : "/pixels";
  };

  const filters = [
    { key: "all", label: "All" },
    { key: "given", label: "Given out" },
    { key: "spent", label: "Spent / removed" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-1">Pixels log</h1>
      <p className="text-sm text-ink/55 mb-5">
        Every pixel movement — who it went to, how many, why, and who granted it. 1 hour = 5
        pixels · 10 pixels = $1 · whole pixels only.
      </p>

      {error && (
        <div className="pixl-card p-3 mb-4 text-sm font-medium text-rose-600">{error}</div>
      )}
      {adjusted && (
        <div className="pixl-card p-3 mb-4 text-sm font-medium text-hc-green">
          Balance adjusted — it&apos;s in the ledger below.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href={qp({ filter: "given" })} className="pixl-card p-4 hover:border-hc-green/50 transition-colors">
          <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">Given out</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-hc-green">{fmt(issued)}</div>
          <div className="text-xs text-ink/45 mt-0.5">≈ ${(issued / 10).toFixed(2)}</div>
        </Link>
        <Link href={qp({ filter: "spent" })} className="pixl-card p-4 hover:border-brand/50 transition-colors">
          <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">Spent / removed</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-brand">{fmt(-spent)}</div>
          <div className="text-xs text-ink/45 mt-0.5">≈ ${(-spent / 10).toFixed(2)}</div>
        </Link>
        <Link href={qp({ filter: "all" })} className="pixl-card p-4 hover:border-[var(--line-strong)] transition-colors">
          <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">Net in wallets</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(net)}</div>
          <div className="text-xs text-ink/45 mt-0.5">≈ ${(net / 10).toFixed(2)}</div>
        </Link>
      </div>

      {access.isSuper && <PixelAdjustForm />}

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="inline-flex items-center rounded-lg border border-[var(--line)] p-0.5 bg-[var(--surface)]">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={qp({ filter: f.key })}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeFilter === f.key
                  ? "bg-ink text-white"
                  : "text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        {user && (
          <Link
            href={activeFilter !== "all" ? `/pixels?filter=${activeFilter}` : "/pixels"}
            className="badge bg-brand/10 text-brand hover:bg-brand/20"
          >
            {userName} ✕
          </Link>
        )}
      </div>

      <div className="pixl-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--line)] text-ink/60">
              <th className="p-3 font-medium">Player</th>
              <th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Reason</th>
              <th className="p-3 font-medium">Project</th>
              <th className="p-3 font-medium">By</th>
              <th className="p-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {slice.map((t) => (
              <tr key={t.id}>
                <td className="p-3">
                  <Link href={`/pixels?user=${t.user_id}`} className="font-medium hover:text-brand">
                    {t.player_name}
                  </Link>
                </td>
                <td
                  className={`p-3 tabular-nums font-semibold ${
                    t.amount >= 0 ? "text-hc-green" : "text-brand"
                  }`}
                >
                  {t.amount >= 0 ? "+" : "−"}
                  {fmt(Math.abs(t.amount))}
                </td>
                <td className="p-3 text-ink/70">{REASON_LABEL[t.reason] ?? (t.reason || "—")}</td>
                <td className="p-3">
                  {t.project_id != null ? (
                    <Link href={`/projects/${t.project_id}`} className="hover:text-brand">
                      {t.project_name}
                    </Link>
                  ) : (
                    <span className="text-ink/40">—</span>
                  )}
                </td>
                <td className="p-3 text-ink/60">{t.created_by || "—"}</td>
                <td className="p-3 text-ink/60">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5 text-ink/50">
                  No pixel activity matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
          <span className="text-ink/50">
            Showing {start + 1}–{Math.min(start + PER, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={qp({ page: cur - 1 })}
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
              href={qp({ page: cur + 1 })}
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
