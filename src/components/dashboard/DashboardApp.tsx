"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";
import { MobileNav } from "./MobileNav";
import { PANELS } from "./panels";
import { IBGate } from "./IBGate";
import { resolveTab } from "@/lib/tabs";
import { EVENTS, trackEvent } from "@/lib/analytics";

/**
 * The whole dashboard is one route driven by `?tab=`. Sidebar entries are real
 * links, so URLs are shareable and back/forward work, but Next's client router
 * swaps the panel without a document navigation.
 */
export function DashboardApp() {
  const params = useSearchParams();
  const tab = resolveTab(params.get("tab"));
  const pair = params.get("pair") ?? undefined;
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the drawer and return to the top whenever the panel changes.
  useEffect(() => {
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: "auto" });
    trackEvent(EVENTS.tabChanged, { tab: tab.slug });
  }, [tab.slug]);

  const Panel = PANELS[tab.slug];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <Sidebar active={tab.slug} />
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex h-full animate-riseIn">
            <Sidebar active={tab.slug} onNavigate={() => setDrawer(false)} />
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close navigation"
              className="ml-3 mt-4 flex h-10 w-10 items-center justify-center self-start rounded-lg border border-white/10 bg-[rgba(16,22,38,0.9)] text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader
          title={tab.slug === "dashboard" ? "Good evening, Trader." : tab.label}
          blurb={tab.blurb}
          onOpenNav={() => setDrawer(true)}
        />
        <main className="flex-1 px-5 pb-28 pt-6 lg:px-8 lg:pb-12">
          {/* The admin queue is never gated — whoever reviews deposits has to be
              able to reach it before anyone is verified. */}
          {tab.slug === "admin" ? (
            <Panel pair={pair} />
          ) : (
            <IBGate>
              <Panel pair={pair} />
            </IBGate>
          )}
        </main>
      </div>

      <MobileNav active={tab.slug} />
    </div>
  );
}
