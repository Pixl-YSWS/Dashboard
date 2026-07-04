export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "denied"
      ? "That Slack account isn't on the admin list."
      : error
        ? "Sign-in failed — try again."
        : null;
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="pixl-card p-10 w-[380px] text-center">
        <div className="font-pixel text-6xl text-brand leading-none">PIXL</div>
        <div className="font-pixel text-xl text-ink/70 mt-1 mb-8">internal dashboard</div>
        {message && (
          <div className="border-2 border-ink bg-brand text-white text-sm p-3 mb-6">
            {message}
          </div>
        )}
        <a href="/api/auth/login" className="pixl-btn bg-ink dark:bg-gray-700 text-white w-full text-center">
          Sign in with Slack
        </a>
        <p className="text-xs text-ink/50 mt-6">
          Access is limited to approved Slack IDs.
        </p>
      </div>
    </div>
  );
}
