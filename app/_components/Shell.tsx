"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavFlags {
  players: boolean;
  projects: boolean;
  review: boolean;
  moderation: boolean;
  notify: boolean;
  admins: boolean;
}

const NAV_LINK =
  "px-3 py-2 shrink-0 hover:bg-white dark:hover:bg-gray-800 border-2 border-transparent hover:border-ink";

function ControlButtons() {
  return (
    <>
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
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Review is a focused, full-width workspace: collapse the sidebar into the
  // mobile-style top bar at every width so the queue gets the whole page.
  const fullWidth = pathname.startsWith("/review");

  const links = (
    <>
      <Link href="/" className={NAV_LINK}>
        Overview
      </Link>
      {nav.players && (
        <Link href="/players" className={NAV_LINK}>
          Players
        </Link>
      )}
      {nav.projects && (
        <Link href="/projects" className={NAV_LINK}>
          Projects
        </Link>
      )}
      {nav.review && (
        <Link href="/review" className={NAV_LINK}>
          Review
        </Link>
      )}
      {nav.moderation && (
        <>
          <Link href="/violations" className={NAV_LINK}>
            Violations
          </Link>
          <Link href="/bans" className={NAV_LINK}>
            Bans
          </Link>
        </>
      )}
      {nav.notify && (
        <Link href="/notify" className={NAV_LINK}>
          Notify
        </Link>
      )}
      {nav.admins && (
        <Link href="/admins" className={NAV_LINK}>
          Sub-admins
        </Link>
      )}
    </>
  );

  return (
    <div className={`flex min-h-screen ${fullWidth ? "flex-col" : "flex-col md:flex-row"}`}>
      <aside
        className={`shrink-0 border-b-2 border-ink bg-parch flex flex-col ${
          fullWidth
            ? ""
            : "md:border-b-0 md:border-r-2 md:w-56 md:sticky md:top-0 md:h-screen md:overflow-y-auto"
        }`}
      >
        <div
          className={`p-4 border-b-2 border-ink flex items-center justify-between gap-3 ${
            fullWidth ? "" : "md:p-5 md:block"
          }`}
        >
          <div>
            <Link
              href="/"
              className={`font-pixel text-3xl text-brand leading-none ${fullWidth ? "" : "md:text-4xl"}`}
            >
              PIXL
            </Link>
            <div
              className={`font-pixel text-ink/70 text-sm mt-1 ${fullWidth ? "hidden" : "hidden md:block"}`}
            >
              internal dashboard
            </div>
          </div>
          <div className={`flex items-center gap-2 ${fullWidth ? "" : "md:hidden"}`}>
            <ControlButtons />
            <form action="/api/auth/logout" method="post">
              <button className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          className={`flex p-2 gap-1 text-sm font-bold overflow-x-auto whitespace-nowrap ${
            fullWidth ? "" : "md:flex-col md:p-3 md:overflow-visible md:whitespace-normal"
          }`}
        >
          {links}
        </nav>
        <div
          className={`mt-auto p-4 border-t-2 border-ink text-xs ${
            fullWidth ? "hidden" : "hidden md:block"
          }`}
        >
          <div className="font-bold truncate">{session.name}</div>
          <div className="text-ink/60 mb-2">{session.slackId}</div>
          <div className="flex gap-2">
            <ControlButtons />
            <form action="/api/auth/logout" method="post" className="flex-1">
              <button className="pixl-btn bg-white dark:bg-gray-800 text-ink text-xs w-full">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className={`flex-1 min-w-0 p-4 md:p-8 ${fullWidth ? "" : "max-w-6xl"}`}>
        {children}
      </main>
    </div>
  );
}
