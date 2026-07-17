export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "denied"
      ? "That Slack account isn't on the Pixl team (or was removed). If you think that's a mistake, contact the Pixl team."
      : error
        ? "Sign-in failed — try again."
        : null;
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="pixl-card p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand text-white font-bold">
            P
          </span>
          <div>
            <div className="font-semibold text-lg tracking-tight leading-none">Pixl</div>
            <div className="text-xs text-ink/50 mt-1">Admin console</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-ink/55 mt-1 mb-6">
          Access is limited to approved Slack accounts.
        </p>
        {message && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 text-sm p-3 mb-5">
            {message}
          </div>
        )}
        <a
          href="/api/auth/login"
          className="pixl-btn bg-ink text-white w-full justify-center border-transparent"
        >
          Continue with Slack
        </a>
      </div>
    </div>
  );
}
