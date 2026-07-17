"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import HcIcon from "@hackclub/icons";
import { GlobalSearch } from "@/app/_components/GlobalSearch";

export interface NavFlags {
  players: boolean;
  projects: boolean;
  review: boolean;
  pixels: boolean;
  moderation: boolean;
  notify: boolean;
  admins: boolean;
  reviewers: boolean;
}

// Hack Club icon glyphs (icons.hackclub.com) mapped to each nav item.
const GLYPHS = {
  overview: "home",
  review: "flag",
  projects: "code",
  players: "people-3",
  pixels: "bank",
  violations: "message",
  bans: "private",
  notify: "bell",
  admins: "person-badge",
  reviewers: "checkmark",
} as const;

type IconKey = keyof typeof GLYPHS;

function Icon({ name }: { name: IconKey }) {
  return (
    <span className="shrink-0 inline-flex" aria-hidden>
      <HcIcon glyph={GLYPHS[name]} size={20} />
    </span>
  );
}

export function Shell({
  session,
  nav,
  reviewCount = 0,
  children,
}: {
  session: { name: string; slackId: string };
  nav: NavFlags;
  reviewCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const tabs: { href: string; label: string; icon: IconKey; show: boolean; count?: number }[] = [
    { href: "/", label: "Overview", icon: "overview", show: true },
    { href: "/review", label: "Needs review", icon: "review", show: nav.review, count: reviewCount },
    { href: "/projects", label: "Projects", icon: "projects", show: nav.projects },
    { href: "/players", label: "Players", icon: "players", show: nav.players },
    { href: "/pixels", label: "Pixels", icon: "pixels", show: nav.pixels },
    { href: "/violations", label: "Violations", icon: "violations", show: nav.moderation },
    { href: "/bans", label: "Bans", icon: "bans", show: nav.moderation },
    { href: "/notify", label: "Notify", icon: "notify", show: nav.notify },
    { href: "/reviewers", label: "Reviewers", icon: "reviewers", show: nav.reviewers },
    { href: "/admins", label: "Sub-admins", icon: "admins", show: nav.admins },
  ];

  const initials = (session.name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-[var(--surface)]/90 backdrop-blur border-b border-[var(--line)]">
        <div className="max-w-[1400px] mx-auto w-full px-4 md:px-6">
          {/* row 1 */}
          <div className="h-16 flex items-center gap-3 md:gap-5">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            >
              <span className="grid place-items-center w-6 h-6 rounded-lg bg-brand text-white text-xs font-bold">
                P
              </span>
              <span className="font-semibold text-sm tracking-tight hidden sm:block">Pixl</span>
            </Link>

            <div className="flex-1 min-w-0 max-w-xl mx-auto">
              <GlobalSearch />
            </div>

            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="grid place-items-center w-9 h-9 rounded-full bg-brand/15 text-brand text-xs font-semibold hover:ring-2 hover:ring-brand/30"
                aria-label="Account menu"
              >
                {initials || "?"}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 pixl-card p-2 shadow-lg z-40">
                  <div className="px-2 py-1.5 mb-1 border-b border-[var(--line)]">
                    <div className="text-sm font-medium truncate">{session.name}</div>
                    <div className="text-xs text-ink/50 truncate">{session.slackId}</div>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                    <span className="text-ink/70">Theme</span>
                    <button
                      data-theme-toggle
                      className="pixl-btn bg-transparent border-0 shadow-none w-8 h-8 p-0 text-ink/70 hover:bg-black/5 dark:hover:bg-white/10"
                      title="Toggle theme"
                    >
                      ☾
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                    <span className="text-ink/70">Text size</span>
                    <button
                      data-font-cycle
                      className="pixl-btn bg-transparent border-0 shadow-none w-8 h-8 p-0 text-ink/70 hover:bg-black/5 dark:hover:bg-white/10"
                      title="Text size"
                    >
                      A
                    </button>
                  </div>
                  <form action="/api/auth/logout" method="post" className="mt-1 pt-1 border-t border-[var(--line)]">
                    <button className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* row 2 — tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto -mb-px">
            {tabs
              .filter((t) => t.show)
              .map((t) => {
                const active = isActive(t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      active
                        ? "border-brand text-brand"
                        : "border-transparent text-ink/60 hover:text-ink"
                    }`}
                  >
                    <Icon name={t.icon} />
                    {t.label}
                    {t.count ? (
                      <span
                        className={`ml-0.5 text-[0.7rem] font-semibold px-1.5 py-0.5 rounded-full ${
                          active ? "bg-brand text-white" : "bg-black/[0.06] dark:bg-white/10 text-ink/60"
                        }`}
                      >
                        {t.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-w-0">
        <div className="max-w-[1400px] mx-auto w-full px-4 md:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
