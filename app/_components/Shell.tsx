"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  online: boolean;
  shop: boolean;
  events: boolean;
  sidequests: boolean;
}

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
  online: "welcome",
  shop: "bag-fill",
  events: "explore",
  sidequests: "compass",
} as const;

type IconKey = keyof typeof GLYPHS;

function Icon({ name }: { name: IconKey }) {
  return (
    <span className="shrink-0 inline-flex" aria-hidden>
      <HcIcon glyph={GLYPHS[name]} size={18} />
    </span>
  );
}

interface Tab {
  href: string;
  label: string;
  icon: IconKey;
  show: boolean;
  count?: number;
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
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const rawGroups: { label: string | null; items: Tab[] }[] = [
    {
      label: null,
      items: [
        { href: "/", label: "Overview", icon: "overview", show: true },
        { href: "/review", label: "Needs review", icon: "review", show: nav.review, count: reviewCount },
        { href: "/projects", label: "Projects", icon: "projects", show: nav.projects },
        { href: "/players", label: "Players", icon: "players", show: nav.players },
        { href: "/online", label: "Online", icon: "online", show: nav.online },
      ],
    },
    {
      label: "Economy",
      items: [
        { href: "/pixels", label: "Pixels", icon: "pixels", show: nav.pixels },
        { href: "/shop", label: "Shop", icon: "shop", show: nav.shop },
        { href: "/events", label: "Events", icon: "events", show: nav.events },
        { href: "/sidequests", label: "Sidequests", icon: "sidequests", show: nav.sidequests },
      ],
    },
    {
      label: "Moderation",
      items: [
        { href: "/violations", label: "Violations", icon: "violations", show: nav.moderation },
        { href: "/bans", label: "Bans", icon: "bans", show: nav.moderation },
      ],
    },
    {
      label: "Admin",
      items: [
        { href: "/notify", label: "Notify", icon: "notify", show: nav.notify },
        { href: "/reviewers", label: "Reviewers", icon: "reviewers", show: nav.reviewers },
        { href: "/admins", label: "Sub-admins", icon: "admins", show: nav.admins },
      ],
    },
  ];
  const groups = rawGroups
    .map((g) => ({ ...g, items: g.items.filter((t) => t.show) }))
    .filter((g) => g.items.length > 0);

  const initials = (session.name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const navLink = (t: Tab) => {
    const active = isActive(t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[0.875rem] font-medium transition-colors ${
          active
            ? "bg-black/[0.05] dark:bg-white/[0.07] text-brand"
            : "text-ink/60 hover:text-ink hover:bg-black/[0.035] dark:hover:bg-white/[0.045]"
        }`}
      >
        <span className={active ? "text-brand" : "text-ink/45 group-hover:text-ink/70"}>
          <Icon name={t.icon} />
        </span>
        <span className="truncate">{t.label}</span>
        {t.count ? (
          <span
            className={`ml-auto text-[0.7rem] font-semibold px-1.5 py-0.5 rounded-full ${
              active ? "bg-brand text-white" : "bg-black/[0.06] dark:bg-white/10 text-ink/60"
            }`}
          >
            {t.count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      {/* mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          className="grid place-items-center w-9 h-9 rounded-lg border border-[var(--line)] hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Open menu"
        >
          <HcIcon glyph="menu" size={20} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="grid place-items-center w-6 h-6 rounded-lg bg-brand text-white text-xs font-bold">P</span>
          <span className="font-semibold text-sm">Pixl HQ</span>
        </Link>
      </header>

      {/* overlay (mobile) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 flex flex-col border-r border-[var(--line)] bg-[var(--surface)] transition-transform duration-200 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 h-16 flex items-center shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand text-white text-sm font-bold">P</span>
            <span className="font-semibold tracking-tight">Pixl HQ</span>
          </Link>
        </div>

        <div className="px-3 pb-2 shrink-0">
          <GlobalSearch />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {groups.map((g, i) => (
            <div key={i} className="space-y-0.5">
              {g.label && (
                <div className="px-2.5 pt-1 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-ink/35">
                  {g.label}
                </div>
              )}
              {g.items.map(navLink)}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[var(--line)] p-3 space-y-2">
          <div className="flex items-center gap-2.5 px-1">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-brand/15 text-brand text-xs font-semibold shrink-0">
              {initials || "?"}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{session.name}</div>
              <div className="text-xs text-ink/45 truncate">{session.slackId}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              data-theme-toggle
              className="grid place-items-center w-8 h-8 rounded-lg border border-[var(--line)] text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
              title="Toggle theme"
            >
              ☾
            </button>
            <button
              data-font-cycle
              className="grid place-items-center w-8 h-8 rounded-lg border border-[var(--line)] text-ink/60 hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
              title="Text size"
            >
              A
            </button>
            <form action="/api/auth/logout" method="post" className="ml-auto">
              <button className="px-3 h-8 rounded-lg border border-[var(--line)] text-sm text-rose-500 hover:bg-rose-500/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="md:pl-64">
        <main className="min-w-0">
          <div className="max-w-[1200px] mx-auto w-full px-4 md:px-8 py-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
