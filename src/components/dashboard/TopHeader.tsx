"use client";

import { Bell, Menu, Search } from "lucide-react";

export function TopHeader({
  title,
  blurb,
  onOpenNav,
}: {
  title: string;
  blurb: string;
  onOpenNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[rgba(7,10,18,0.78)] backdrop-blur-xl">
      <div className="flex items-center gap-4 px-5 py-4 lg:px-8 lg:py-5">
        <button
          type="button"
          onClick={onOpenNav}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-ink transition-colors duration-200 hover:border-brand-blue/40 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold tracking-tight text-white sm:text-[20px] lg:text-[24px]">
            {title}
          </h1>
          <p className="mt-1 hidden truncate text-[14px] text-ink-muted sm:block">{blurb}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <label className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              placeholder="Search markets, traders, lessons"
              aria-label="Search"
              className="h-10 w-[240px] rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-muted/70 outline-none backdrop-blur-xl transition-all duration-200 focus:border-brand-blue/40 focus:bg-white/[0.05] focus:shadow-glow lg:w-[280px]"
            />
          </label>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-ink-muted transition-all duration-200 hover:border-brand-blue/40 hover:text-white hover:shadow-glow"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-brand-danger ring-2 ring-[#0A0F1C]" />
          </button>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-blue/30 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[12px] font-bold text-white transition-shadow duration-200 hover:shadow-glow"
            aria-label="Account menu"
          >
            RS
          </button>
        </div>
      </div>
    </header>
  );
}
