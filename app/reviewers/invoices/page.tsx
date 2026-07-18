import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/guard";
import { payoutInvoice } from "@/lib/db";

export const dynamic = "force-dynamic";

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const access = await requireAdmin();
  if (!access.isSuper) redirect("/");
  const { m } = await searchParams;

  const now = new Date();
  const key = m && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(now);
  const [year, month] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const prev = monthKey(new Date(Date.UTC(year, month - 2, 1)));
  const next = monthKey(end);
  const isCurrent = key === monthKey(now);

  const rows = await payoutInvoice(start, end);
  const totals = rows.reduce(
    (acc, r) => {
      acc.payouts += r.payouts;
      acc.paidPixels += r.paidPixels;
      acc.fullPixels += r.fullPixels;
      acc.cuts += r.cuts;
      return acc;
    },
    { payouts: 0, paidPixels: 0, fullPixels: 0, cuts: 0 },
  );
  const monthName = start.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reviewers" className="text-sm text-ink/50 hover:text-brand">
          ← Reviewers
        </Link>
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink tracking-tight">Payout invoices</h1>
          <p className="text-sm text-ink/55 mt-1 max-w-2xl">
            What each reviewer earned from the $1-per-review payouts, month by month. 10 pixels
            = $1 — settle the dollar column however you pay people.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/reviewers/invoices?m=${prev}`} className="pixl-btn bg-[var(--surface)] text-ink text-sm">
            ←
          </Link>
          <span className="text-sm font-semibold px-1 whitespace-nowrap">{monthName}</span>
          <Link
            href={`/reviewers/invoices?m=${next}`}
            className={`pixl-btn bg-[var(--surface)] text-ink text-sm ${
              isCurrent ? "pointer-events-none opacity-40" : ""
            }`}
          >
            →
          </Link>
          <a
            href={`/api/invoices?m=${key}`}
            className="pixl-btn bg-ink dark:bg-gray-700 text-white text-sm ml-2"
          >
            Download CSV
          </a>
        </div>
      </div>

      <div className="pixl-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--line)] bg-parch">
              <th className="p-3">Reviewer</th>
              <th className="p-3">Reviews paid</th>
              <th className="p-3">Pixels</th>
              <th className="p-3">Owed</th>
              <th className="p-3">Cuts</th>
              <th className="p-3">Not credited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((r) => (
              <tr key={r.slackId} className="hover:bg-cream">
                <td className="p-3">
                  <Link href={`/reviewers/${r.slackId}`} className="font-bold hover:text-brand">
                    {r.reviewer}
                  </Link>
                  <div className="text-xs text-ink/50 font-mono">{r.slackId}</div>
                </td>
                <td className="p-3 tabular-nums">{r.payouts}</td>
                <td className="p-3 tabular-nums">
                  {r.paidPixels}
                  {r.paidPixels < r.fullPixels && (
                    <span className="text-xs text-ink/50"> of {r.fullPixels}</span>
                  )}
                </td>
                <td className="p-3 tabular-nums font-semibold">
                  ${(r.paidPixels / 10).toFixed(2)}
                </td>
                <td
                  className={`p-3 tabular-nums ${
                    r.cuts > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : ""
                  }`}
                >
                  {r.cuts}
                </td>
                <td
                  className={`p-3 tabular-nums ${
                    r.uncredited > 0 ? "text-tang font-bold" : ""
                  }`}
                >
                  {r.uncredited}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-5 text-ink/50" colSpan={6}>
                  No settled payouts in {monthName}.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--line)] bg-parch font-semibold">
                <td className="p-3">Total</td>
                <td className="p-3 tabular-nums">{totals.payouts}</td>
                <td className="p-3 tabular-nums">{totals.paidPixels}</td>
                <td className="p-3 tabular-nums">${(totals.paidPixels / 10).toFixed(2)}</td>
                <td className="p-3 tabular-nums">{totals.cuts}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
