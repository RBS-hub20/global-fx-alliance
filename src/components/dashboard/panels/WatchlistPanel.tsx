"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search, Star, X } from "lucide-react";
import { Sparkline } from "@/components/ui/Sparkline";
import {
  Card, EmptyState, Modal, PanelHeader, Skeleton, Toast,
} from "@/components/ui/Primitives";
import { PAIRS, getPair, sparkFor } from "@/lib/market";
import { KEYS, usePersistentState } from "@/lib/storage";
import { EVENTS, trackEvent } from "@/lib/analytics";
import { tabHref } from "@/lib/tabs";

const DEFAULT_WATCHLIST = ["EUR/USD", "XAU/USD", "GBP/USD"];

export function WatchlistPanel() {
  const { value: list, setValue: setList, hydrated } = usePersistentState<string[]>(
    KEYS.watchlist,
    DEFAULT_WATCHLIST
  );
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  const available = useMemo(
    () =>
      PAIRS.filter(
        (p) =>
          !list.includes(p.symbol) &&
          (p.symbol.toLowerCase().includes(query.toLowerCase()) ||
            p.name.toLowerCase().includes(query.toLowerCase()))
      ),
    [list, query]
  );

  const add = (symbol: string) => {
    setList((prev) => (prev.includes(symbol) ? prev : [...prev, symbol]));
    trackEvent(EVENTS.watchlistAdd, { pair: symbol });
    flash(`${symbol} added to watchlist`);
  };

  const remove = (symbol: string) => {
    setList((prev) => prev.filter((s) => s !== symbol));
    flash(`${symbol} removed`);
  };

  return (
    <div className="space-y-6">
      <PanelHeader
        title="My Watchlist"
        action={
          <button type="button" onClick={() => setAdding(true)} className="btn-primary !px-4 !py-2 text-[12.5px]">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Add Pair
          </button>
        }
      />

      {!hydrated ? (
        <div className="space-y-3">
          <Skeleton className="h-[76px] w-full" />
          <Skeleton className="h-[76px] w-full" />
          <Skeleton className="h-[76px] w-full" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No pairs yet"
          body="Add the instruments you follow and they'll be here every time you open the dashboard on this device."
          action={
            <button type="button" onClick={() => setAdding(true)} className="btn-primary">
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Add your first pair
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-white/[0.06]">
            {list.map((symbol) => {
              const p = getPair(symbol);
              const up = p.changePct >= 0;
              return (
                <li key={symbol} className="group flex items-center gap-4 px-4 py-4 transition-colors duration-200 hover:bg-white/[0.02] sm:px-5">
                  <Link href={tabHref("market-analysis", symbol)} className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold tracking-tight text-white">
                        {p.symbol}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
                        {p.name}
                      </span>
                    </span>

                    <span className="hidden shrink-0 sm:block">
                      <Sparkline points={sparkFor(symbol)} positive={up} width={110} height={38} className="opacity-90" />
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="num-mono block text-[16px] font-bold leading-none text-white">
                        {p.price.toFixed(p.decimals)}
                      </span>
                      <span
                        className={`num-mono mt-1.5 block text-[12.5px] font-semibold ${
                          up ? "text-brand-green" : "text-brand-danger"
                        }`}
                      >
                        {up ? "+" : ""}
                        {p.changePct.toFixed(2)}%
                      </span>
                    </span>

                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-ink-muted/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-blue sm:block" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => remove(symbol)}
                    aria-label={`Remove ${symbol} from watchlist`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-ink-muted transition-all duration-200 hover:border-brand-danger/40 hover:text-brand-danger"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {hydrated && list.length > 0 ? (
        <p className="text-[11.5px] text-ink-muted/70">
          Saved to this browser only — it never leaves your device.
        </p>
      ) : null}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a pair">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pairs"
            aria-label="Search pairs"
            className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-[14px] text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/40 focus:shadow-glow"
          />
        </label>

        <ul className="mt-4 max-h-[320px] space-y-1.5 overflow-y-auto">
          {available.length === 0 ? (
            <li className="px-1 py-6 text-center text-[13px] text-ink-muted">
              {query ? "No matches." : "Everything is already on your watchlist."}
            </li>
          ) : (
            available.map((p) => (
              <li key={p.symbol}>
                <button
                  type="button"
                  onClick={() => add(p.symbol)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-left transition-all duration-200 hover:border-brand-blue/30 hover:bg-brand-blue/[0.06]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-white">{p.symbol}</span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">{p.name}</span>
                  </span>
                  <span className="num-mono shrink-0 text-[13px] text-ink-muted">
                    {p.price.toFixed(p.decimals)}
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-brand-blue" strokeWidth={2.4} />
                </button>
              </li>
            ))
          )}
        </ul>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
