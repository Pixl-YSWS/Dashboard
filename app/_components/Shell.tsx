"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GlobalSearch } from "@/app/_components/GlobalSearch";

export interface NavFlags {
  players: boolean;
  projects: boolean;
  review: boolean;
  moderation: boolean;
  notify: boolean;
  admins: boolean;
}

const I = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  players: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6" />
      <path d="M17 14.5a5.2 5.2 0 0 1 3.5 5" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 7.5V16l9 4.5 9-4.5V7.5" />
      <path d="M12 12v8.5" />
    </>
  ),
  review: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="m8.5 12.5 2 2 4-4.5" />
    </>
  ),
  violations: (
    <>
      <path d="M12 3.5 22 20H2L12 3.5Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
  bans: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  notify: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  admins: (
    <>
      <path d="M12 3 5 6v5.5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

type IconKey = keyof typeof I;

function Icon({ name }: { name: IconKey }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {I[name]}
    </svg>
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
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tabs: { href: string; label: string; icon: IconKey; show: boolean; count?: number }[] = [
    { href: "/", label: "Overview", icon: "overview", show: true },
    { href: "/review", label: "Needs review", icon: "review", show: nav.review, count: reviewCount },
    { href: "/projects", label: "Projects", icon: "projects", show: nav.projects },
    { href: "/players", label: "Players", icon: "players", show: nav.players },
    { href: "/violations", label: "Violations", icon: "violations", show: nav.moderation },
    { href: "/bans", label: "Bans", icon: "bans", show: nav.moderation },
    { href: "/notify", label: "Notify", icon: "notify", show: nav.notify },
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
