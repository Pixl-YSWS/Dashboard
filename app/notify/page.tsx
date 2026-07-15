import { redirect } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { NotifyForm } from "@/app/_components/NotifyForm";

export const dynamic = "force-dynamic";

export default async function NotifyPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const access = await requirePagePerm(["notify"]);
  if (!access.isSuper && !access.perms.has("notify")) redirect("/");
  const { sent, error } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-1">Notify</h1>
      <p className="text-sm text-ink/55 mb-5 max-w-2xl">
        Drop a message into players&apos; in-game inbox (the [N] menu). Choose everyone or a
        single player.
      </p>

      {sent && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 p-3 text-sm font-medium">
          Sent to {sent === "1" ? "1 player" : `${sent} players`}.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 p-3 text-sm font-medium">
          {error}
        </div>
      )}

      <NotifyForm />
    </div>
  );
}
