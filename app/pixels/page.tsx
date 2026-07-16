import Link from "next/link";
import { requirePagePerm } from "@/lib/guard";
import { listPixelTransactions } from "@/lib/db";

export const dynamic = "force-dynamic";

const PER = 25;

const REASON_LABEL: Record<string, string> = {
  project_approved: "Project approved",
};

function fmt(n: number): string {
  return Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2);
}

export default async function PixelsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePagePerm(["review"]);
  const { page } = await searchParams;
  const all = await listPixelTransactions(1000);

  const issued = all.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent = all.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const net = issued + spent;

  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const rows = all.slice(start, start + PER);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-1">Pixels log</h1>
      <p className="text-sm text-ink/55 mb-5">
        Every pixel movement — who it went to, how many, why, and who granted it. 1 approved hour =
        1 pixel.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="pixl-card p-4">
          <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">Given out</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-hc-green">{fmt(issued)}</div>
        </div>
        <div className="pixl-card p-4">
          <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">Spent</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-brand">{fmt(-spent)}</div>
        </div>
        <div className="pixl-card p-4">
          <div className="text-xs font-medium text-ink/50 uppercase tracking-wide">Net in wallets</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{fmt(net)}</div>
        </div>
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
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="p-3">
                  <Link href={`/players/${t.user_id}`} className="font-medium hover:text-brand">
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5 text-ink/50">
                  No pixel activity yet.
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
              href={`/pixels?page=${cur - 1}`}
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
              href={`/pixels?page=${cur + 1}`}
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
