import type { Metadata } from "next";
import "./globals.css";
import { getAccess, canView } from "@/lib/guard";
import { countPendingReviews } from "@/lib/db";
import { Shell } from "@/app/_components/Shell";

export const metadata: Metadata = {
  title: "Pixl HQ",
  description: "The Pixl team's home for reviews, players, and pixels",
  icons: { icon: "/favicon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccess();
  const session = access?.session ?? null;
  const nav = access
    ? {
        players: canView(access, ["warn", "ban"]),
        projects: canView(access, ["review", "warn", "ban"]),
        review: canView(access, ["review"]),
        pixels: access.isSuper,
        moderation: canView(access, ["warn", "ban"]),
        notify: access.isSuper || access.perms.has("notify"),
        admins: access.isSuper,
        reviewers: access.isSuper,
        online: canView(access, ["warn", "ban"]),
        shop: access.isSuper,
      }
    : null;
  const reviewCount = nav?.review ? await countPendingReviews() : 0;
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
    if (t !== "light") {
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
        {session && nav ? (
          <Shell
            session={{ name: session.name, slackId: session.slackId }}
            nav={nav}
            reviewCount={reviewCount}
          >
            {children}
          </Shell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
