import { redirect } from "next/navigation";
import { requirePagePerm } from "@/lib/guard";
import { sendNotification } from "@/app/actions";

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
      <h1 className="text-2xl font-semibold text-ink tracking-tight mb-2">Notify</h1>
      <p className="text-sm text-ink/60 mb-6">
        Drops a message into players&apos; in-game inbox (the [N] menu). Leave
        the player field empty to send to everyone.
      </p>

      {sent && (
        <div className="pixl-card p-3 mb-4 bg-mint/20 text-sm font-bold">
          Sent to {sent === "1" ? "1 player" : `${sent} players`}.
        </div>
      )}
      {error && (
        <div className="pixl-card p-3 mb-4 bg-brand/15 text-sm font-bold">{error}</div>
      )}

      <div className="pixl-card p-4 max-w-xl">
        <form action={sendNotification} className="flex flex-col gap-3">
          <input type="hidden" name="backTo" value="/notify" />
          <input
            name="playerName"
            placeholder="Player name (empty = everyone)"
            className="pixl-input text-sm"
          />
          <input
            name="title"
            placeholder="Title"
            maxLength={100}
            className="pixl-input text-sm"
            required
          />
          <textarea
            name="body"
            placeholder="Message"
            maxLength={500}
            rows={4}
            className="pixl-input text-sm"
            required
          />
          <button className="pixl-btn bg-brand text-white text-sm self-start">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
