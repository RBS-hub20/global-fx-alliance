"use client";

import Link from "next/link";
import { MOBILE_TABS, TAB_BY_SLUG, tabHref } from "@/lib/tabs";

/** Fixed bottom bar below 1024px; the sidebar becomes a drawer at that breakpoint. */
export function MobileNav({ active }: { active: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[rgba(8,12,24,0.86)] backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-2">
        {MOBILE_TABS.map((t) => {
          const tab = TAB_BY_SLUG[t.slug];
          const on = active === t.slug;
          return (
            <li key={t.slug} className="flex-1">
              <Link
                href={tabHref(t.slug)}
                aria-current={on ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors duration-200 ${
                  on ? "text-brand-blue" : "text-ink-muted"
                }`}
              >
                <tab.icon className="h-[19px] w-[19px]" strokeWidth={on ? 2.1 : 1.8} />
                <span className="text-[10px] font-medium leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
