"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
      width="18"
      height="18"
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

const TITLES: [string, string][] = [
  ["/players", "Players"],
  ["/projects", "Projects"],
  ["/review/log", "Review · Log"],
  ["/review", "Review queue"],
  ["/violations", "Violations"],
  ["/bans", "Bans"],
  ["/notify", "Notify"],
  ["/admins", "Sub-admins"],
];

function ControlButtons() {
  return (
    <>
      <button
        data-theme-toggle
        title="Toggle theme"
        aria-label="Toggle theme"
        className="pixl-btn bg-transparent border-0 shadow-none w-9 h-9 p-0 text-ink/70 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
      >
        ☾
      </button>
      <button
        data-font-cycle
        title="Text size"
        aria-label="Text size"
        className="pixl-btn bg-transparent border-0 shadow-none w-9 h-9 p-0 text-ink/70 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
      >
        A
      </button>
    </>
  );
}

export function Shell({
  session,
  nav,
  children,
}: {
  session: { name: string; slackId: string };
  nav: NavFlags;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebarCollapsed") === "1");
    } catch {}
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const nv = !v;
      try {
        localStorage.setItem("sidebarCollapsed", nv ? "1" : "0");
      } catch {}
      return nv;
    });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const title = TITLES.find(([h]) => pathname.startsWith(h))?.[1] ?? "Overview";

  const items: { href: string; label: string; icon: IconKey; show: boolean }[] = [
    { href: "/", label: "Overview", icon: "overview", show: true },
    { href: "/players", label: "Players", icon: "players", show: nav.players },
    { href: "/projects", label: "Projects", icon: "projects", show: nav.projects },
    { href: "/review", label: "Review", icon: "review", show: nav.review },
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

  const renderSidebar = (mini: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={`flex items-center h-16 border-b border-[var(--line)] ${
          mini ? "justify-center px-0" : "gap-2.5 px-5"
        }`}
      >
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand text-white font-bold text-sm shrink-0">
          P
        </span>
        {!mini && (
          <div className="leading-tight">
            <div className="font-semibold text-[0.95rem] tracking-tight">Pixl</div>
            <div className="text-[0.7rem] text-ink/50 -mt-0.5">Admin console</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {items
          .filter((i) => i.show)
          .map((i) => {
            const active = isActive(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                title={mini ? i.label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  mini ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2"
                } ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-ink/70 hover:text-ink hover:bg-black/[0.045] dark:hover:bg-white/[0.06]"
                }`}
              >
                <Icon name={i.icon} />
                {!mini && i.label}
              </Link>
            );
          })}
      </nav>

      <div className="p-3 border-t border-[var(--line)]">
        <div className={`flex items-center ${mini ? "flex-col gap-2" : "gap-2.5 px-2 py-1.5"}`}>
          <span className="grid place-items-center w-8 h-8 rounded-full bg-ink text-white text-xs font-semibold shrink-0">
            {initials || "?"}
          </span>
          {!mini && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{session.name}</div>
              <div className="text-[0.7rem] text-ink/50 truncate">{session.slackId}</div>
            </div>
          )}
          <form action="/api/auth/logout" method="post">
            <button
              title="Sign out"
              aria-label="Sign out"
              className="pixl-btn bg-transparent border-0 shadow-none w-8 h-8 p-0 text-ink/60 hover:text-brand hover:bg-black/5 dark:hover:bg-white/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                <path d="M10 17l-5-5 5-5" />
                <path d="M15 12H5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside
        className={`hidden md:block shrink-0 border-r border-[var(--line)] bg-[var(--surface)] sticky top-0 h-screen transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {renderSidebar(collapsed)}
      </aside>

      {/* mobile slide-over */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[var(--surface)] border-r border-[var(--line)] transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebar(false)}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 md:px-8 border-b border-[var(--line)] bg-[var(--surface)]/85 backdrop-blur">
          <button
            className="md:hidden pixl-btn bg-transparent border-0 shadow-none w-9 h-9 p-0 text-ink/70"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            className="hidden md:inline-flex items-center justify-center pixl-btn bg-transparent border-0 shadow-none w-9 h-9 p-0 text-ink/55 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
              {collapsed ? <path d="m13 9 3 3-3 3" /> : <path d="m16 9-3 3 3 3" />}
            </svg>
          </button>
          <div className="min-w-0 hidden lg:flex items-center gap-1.5 text-sm shrink-0">
            <span className="text-ink/45">Dashboard</span>
            <span className="text-ink/30">/</span>
            <span className="font-medium truncate">{title}</span>
          </div>
          <div className="flex-1 flex justify-end lg:justify-center px-1">
            <div className="w-full max-w-md">
              <GlobalSearch />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ControlButtons />
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
