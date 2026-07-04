import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Pixl — internal",
  description: "Pixl moderation dashboard",
  icons: { icon: "/favicon.png" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var html = document.documentElement;
  try {
    var t = localStorage.getItem("theme");
    if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      html.classList.add("dark");
    }
  } catch(e) {}
  document.addEventListener("click", function(e) {
    var btn = e.target.closest("#theme-toggle");
    if (!btn) return;
    html.classList.toggle("dark");
    btn.textContent = html.classList.contains("dark") ? "\u2600" : "\u263E";
    try { localStorage.setItem("theme", html.classList.contains("dark") ? "dark" : "light"); } catch(e) {}
  });
})();
`,
          }}
        />
      </head>
      <body className="min-h-screen">
        {session ? (
          <div className="flex min-h-screen">
            <aside className="w-56 shrink-0 border-r-2 border-ink bg-parch flex flex-col">
              <div className="p-5 border-b-2 border-ink">
                <Link
                  href="/"
                  className="font-pixel text-4xl text-brand leading-none"
                >
                  PIXL
                </Link>
                <div className="font-pixel text-ink/70 text-sm mt-1">
                  internal dashboard
                </div>
              </div>
              <nav className="flex flex-col p-3 gap-1 text-sm font-bold">
                <Link
                  href="/"
                  className="px-3 py-2 hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-ink"
                >
                  Overview
                </Link>
                <Link
                  href="/players"
                  className="px-3 py-2 hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-ink"
                >
                  Players
                </Link>
                <Link
                  href="/violations"
                  className="px-3 py-2 hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-ink"
                >
                  Violations
                </Link>
              </nav>
              <div className="mt-auto p-4 border-t-2 border-ink text-xs">
                <div className="font-bold truncate">{session.name}</div>
                <div className="text-ink/60 mb-2">{session.slackId}</div>
                <div className="flex gap-2">
                  <button
                    id="theme-toggle"
                    className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs"
                  >
                    ☾
                  </button>
                  <form action="/api/auth/logout" method="post" className="flex-1">
                    <button className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs w-full">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </aside>
            <main className="flex-1 p-8 max-w-6xl">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
