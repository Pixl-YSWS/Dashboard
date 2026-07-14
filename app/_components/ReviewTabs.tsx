"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ReviewTabs({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname();
  const tabs: { href: string; label: string }[] = [{ href: "/review", label: "Queue" }];
  if (isSuper) tabs.push({ href: "/review/log", label: "Log" });

  return (
    <div className="flex gap-2 mb-4 border-b-2 border-ink/20">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 font-pixel border-2 border-b-0 -mb-0.5 ${
              active
                ? "border-ink bg-parch text-ink"
                : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
