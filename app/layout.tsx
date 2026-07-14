import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getAccess, canView } from "@/lib/guard";

export const metadata: Metadata = {
  title: "Pixl — internal",
  description: "Pixl moderation dashboard",
  icons: { icon: "/favicon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const NAV_LINK =
  "px-3 py-2 shrink-0 hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-ink";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();
  const session = access?.session ?? null;
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
  var scales = [1, 1.15, 1.3];
  var labels = ["A", "A+", "A++"];
  function applyFont(i) {
    html.style.setProperty("--font-scale", scales[i]);
    document.querySelectorAll("[data-font-cycle]").forEach(function(b) {
      b.textContent = labels[i];
    });
  }
  var fi = 0;
  try {
    var saved = parseInt(localStorage.getItem("fontStep") || "0", 10);
    if (saved >= 0 && saved < scales.length) fi = saved;
  } catch(e) {}
  applyFont(fi);
  document.addEventListener("click", function(e) {
    var themeBtn = e.target.closest("[data-theme-toggle]");
    if (themeBtn) {
      html.classList.toggle("dark");
      var dark = html.classList.contains("dark");
      document.querySelectorAll("[data-theme-toggle]").forEach(function(b) {
        b.textContent = dark ? "☀" : "☾";
      });
      try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch(e) {}
      return;
    }
    var fontBtn = e.target.closest("[data-font-cycle]");
    if (fontBtn) {
      fi = (fi + 1) % scales.length;
      applyFont(fi);
      try { localStorage.setItem("fontStep", String(fi)); } catch(e) {}
    }
  });
})();
`,
          }}
        />
      </head>
      <body className="min-h-screen">
        {session ? (
          <div className="flex flex-col md:flex-row min-h-screen">
            <aside className="md:w-56 shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-ink bg-parch flex flex-col md:sticky md:top-0 md:h-screen md:overflow-y-auto">
              <div className="p-4 md:p-5 border-b-2 border-ink flex items-center justify-between gap-3 md:block">
                <div>
                  <Link
                    href="/"
                    className="font-pixel text-3xl md:text-4xl text-brand leading-none"
                  >
                    PIXL
                  </Link>
                  <div className="font-pixel text-ink/70 text-sm mt-1 hidden md:block">
                    internal dashboard
                  </div>
                </div>
                <div className="flex items-center gap-2 md:hidden">
                  <button
                    data-theme-toggle
                    className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs"
                  >
                    ☾
                  </button>
                  <button
                    data-font-cycle
                    className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs"
                  >
                    A
                  </button>
                  <form action="/api/auth/logout" method="post">
                    <button className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
              <nav className="flex md:flex-col p-2 md:p-3 gap-1 text-sm font-bold overflow-x-auto md:overflow-visible whitespace-nowrap md:whitespace-normal">
                <Link href="/" className={NAV_LINK}>
                  Overview
                </Link>
                {access && canView(access, ["warn", "ban"]) && (
                  <Link href="/players" className={NAV_LINK}>
                    Players
                  </Link>
                )}
                {access && canView(access, ["review", "warn", "ban"]) && (
                  <Link href="/projects" className={NAV_LINK}>
                    Projects
                  </Link>
                )}
                {access && canView(access, ["review"]) && (
                  <Link href="/review" className={NAV_LINK}>
                    Review
                  </Link>
                )}
                {access && canView(access, ["warn", "ban"]) && (
                  <>
                    <Link href="/violations" className={NAV_LINK}>
                      Violations
                    </Link>
                    <Link href="/bans" className={NAV_LINK}>
                      Bans
                    </Link>
                  </>
                )}
                {(access?.isSuper || access?.perms.has("notify")) && (
                  <Link href="/notify" className={NAV_LINK}>
                    Notify
                  </Link>
                )}
                {access?.isSuper && (
                  <Link href="/admins" className={NAV_LINK}>
                    Sub-admins
                  </Link>
                )}
              </nav>
              <div className="mt-auto p-4 border-t-2 border-ink text-xs hidden md:block">
                <div className="font-bold truncate">{session.name}</div>
                <div className="text-ink/60 mb-2">{session.slackId}</div>
                <div className="flex gap-2">
                  <button
                    data-theme-toggle
                    title="Toggle theme"
                    className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs"
                  >
                    ☾
                  </button>
                  <button
                    data-font-cycle
                    title="Text size"
                    className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs"
                  >
                    A
                  </button>
                  <form action="/api/auth/logout" method="post" className="flex-1">
                    <button className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs w-full">
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </aside>
            <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl">{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
