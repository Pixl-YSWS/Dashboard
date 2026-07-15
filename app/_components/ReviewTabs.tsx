"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReviewTabs({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname();
  const tabs: { href: string; label: string }[] = [{ href: "/review", label: "Queue" }];
  if (isSuper) tabs.push({ href: "/review/log", label: "Reviewer log" });

  return (
    <div className="flex gap-6 mb-6 border-b border-[var(--line)]">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative -mb-px px-0.5 pb-3 text-sm font-medium transition-colors ${
              active
                ? "text-brand border-b-2 border-brand"
                : "text-ink/55 hover:text-ink border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
