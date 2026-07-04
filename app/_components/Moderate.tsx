import { banPlayer, liftBan, warnPlayer } from "@/app/actions";

export function WarnForm({ userId, compact = false }: { userId: string; compact?: boolean }) {
  return (
    <form action={warnPlayer} className="flex gap-2 items-center">
      <input type="hidden" name="userId" value={userId} />
      {!compact && (
        <input
          name="message"
          placeholder="Custom warning (optional)"
          className="pixl-input text-sm flex-1"
        />
      )}
      <button className="pixl-btn bg-tang text-ink text-sm">Warn</button>
    </form>
  );
}

export function BanForm({ userId, compact = false }: { userId: string; compact?: boolean }) {
  return (
    <form action={banPlayer} className="flex gap-2 items-center flex-wrap">
      <input type="hidden" name="userId" value={userId} />
      {!compact && (
        <input
          name="reason"
          placeholder="Reason"
          className="pixl-input text-sm flex-1 min-w-32"
        />
      )}
      <select name="hours" className="pixl-input text-sm" defaultValue="24">
        <option value="1">1 hour</option>
        <option value="24">1 day</option>
        <option value="168">7 days</option>
        <option value="720">30 days</option>
        <option value="0">Permanent</option>
      </select>
      <button className="pixl-btn bg-brand text-white text-sm">Ban</button>
    </form>
  );
}

export function LiftBanForm({ banId, userId }: { banId: number; userId: string }) {
  return (
    <form action={liftBan}>
      <input type="hidden" name="banId" value={banId} />
      <input type="hidden" name="userId" value={userId} />
      <button className="pixl-btn bg-mint text-ink text-sm">Lift ban</button>
    </form>
  );
}
