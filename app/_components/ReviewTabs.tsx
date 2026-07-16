"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReviewTabs({
  isSuper,
  pending,
}: {
  isSuper: boolean;
  pending?: number;
}) {
  const pathname = usePathname();
  const tabs: { href: string; label: string; count?: number }[] = [
    { href: "/review", label: "Needs review", count: pending },
    { href: "/review/reviewed", label: "Reviewed" },
    { href: "/review/stats", label: "Stats" },
  ];
  if (isSuper) tabs.push({ href: "/review/log", label: "Reviewer log" });

  return (
    <div className="flex gap-6 mb-6 border-b border-[var(--line)]">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative -mb-px px-0.5 pb-3 text-sm font-medium transition-colors flex items-center gap-2 ${
              active
                ? "text-brand border-b-2 border-brand"
                : "text-ink/55 hover:text-ink border-b-2 border-transparent"
            }`}
          >
            {t.label}
            {t.count ? (
              <span
                className={`text-[0.7rem] font-semibold px-1.5 py-0.5 rounded-full ${
                  active ? "bg-brand text-white" : "bg-black/[0.06] dark:bg-white/10 text-ink/60"
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
