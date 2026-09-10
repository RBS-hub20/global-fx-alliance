"use client";

import { Bell, BellRing, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardHead } from "@/components/ui/Primitives";
import type { Drawings } from "@/lib/autoDraw";
import { levelsToText, liquidityZones } from "@/lib/marketData";

/**
 * Fair-value gaps, structural stop zones, and price alerts.
 *
 * The stop zones are an inference and are labelled as one. No retail feed
 * publishes resting orders in spot FX, so anything that draws "where the stops
 * are" is modelling the same observation this does — that stops cluster just
 * beyond levels other people can also see. Showing the level each zone comes
 * from lets a reader check the reasoning instead of trusting the output.
 */

const ALERT_KEY = "gfxa-price-alerts";

interface Alert { pair: string; price: number; }

export function StructureBoard({
  pair, drawings, price, decimals, pipSize, onFocusLevel,
}: {
  pair: string;
  drawings: Drawings;
  price: number;
  decimals: number;
  pipSize: number;
  onFocusLevel?: (price: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    try { setAlerts(JSON.parse(localStorage.getItem(ALERT_KEY) ?? "[]")); } catch { /* private mode */ }
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const zones = liquidityZones(drawings, price, pipSize);

  const armAlert = async (at: number) => {
    if (typeof Notification === "undefined") return;
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    setPermission(perm);

    const next = [...alerts.filter((a) => !(a.pair === pair && a.price === at)), { pair, price: at }];
    setAlerts(next);
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const copy = () => {
    navigator.clipboard?.writeText(levelsToText(drawings, pair, decimals));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const armed = (at: number) => alerts.some((a) => a.pair === pair && a.price === at);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ------------------------------------------------------------- FVGs */}
      <Card>
        <CardHead title="Fair-value gaps" />
        <div className="p-5">
          {drawings.fvgs.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">None left unfilled in this window.</p>
          ) : (
            <ul className="space-y-2">
              {drawings.fvgs.map((g, i) => {
                const bull = g.type === "bullish";
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onFocusLevel?.((g.high + g.low) / 2)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                        bull
                          ? "border-brand-green/30 bg-brand-green/[0.07] hover:bg-brand-green/[0.12]"
                          : "border-brand-danger/30 bg-brand-danger/[0.07] hover:bg-brand-danger/[0.12]"
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${bull ? "text-brand-green" : "text-brand-danger"}`}>
                        {bull ? "Bullish" : "Bearish"}
                      </span>
                      <span className="num-mono text-[13px] font-semibold text-white">
                        {g.low.toFixed(decimals)} – {g.high.toFixed(decimals)}
                      </span>
                      <span className="ml-auto text-[11px] text-ink-muted">
                        {g.sizePct.toFixed(2)}% wide
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={copy}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 py-1.5 text-[11.5px] text-ink-muted transition-colors hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-brand-green" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Levels copied" : "Copy levels"}
          </button>
        </div>
      </Card>

      {/* -------------------------------------------------------- stop zones */}
      <Card>
        <CardHead title="Where stops would sit" />
        <div className="p-5">
          {zones.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No levels detected to derive zones from.</p>
          ) : (
            <ul className="space-y-1.5">
              {zones.map((z) => (
                <li key={`${z.side}-${z.price}`} className="flex items-center gap-3 text-[12.5px]">
                  <span className={`w-9 shrink-0 text-[10px] font-bold uppercase ${z.side === "above" ? "text-brand-danger" : "text-brand-green"}`}>
                    {z.side}
                  </span>
                  <span className="num-mono font-semibold text-white">{z.price.toFixed(decimals)}</span>
                  <span className="truncate text-[11px] text-ink-muted">{z.from}</span>
                  <span className="num-mono ml-auto text-[11px] text-ink-muted">{z.distancePct >= 0 ? "+" : ""}{z.distancePct.toFixed(2)}%</span>
                  <button
                    type="button"
                    onClick={() => void armAlert(z.price)}
                    aria-label={`Alert at ${z.price.toFixed(decimals)}`}
                    className={`shrink-0 rounded border px-1.5 py-1 transition-colors ${
                      armed(z.price) ? "border-[#fbbf24]/50 text-[#fbbf24]" : "border-white/[0.1] text-ink-muted hover:text-white"
                    }`}
                  >
                    {armed(z.price) ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted/70">
            Inferred from the levels above, not from order-book data — no retail feed publishes resting
            orders in spot FX. Each zone names the level it comes from.
          </p>
          {permission === "denied" ? (
            <p className="mt-2 text-[11px] text-[#fbbf24]">
              Notifications are blocked for this site, so alerts will not appear.
            </p>
          ) : permission === "unsupported" ? (
            <p className="mt-2 text-[11px] text-[#fbbf24]">This browser has no notification support.</p>
          ) : alerts.length ? (
            <p className="mt-2 text-[11px] text-ink-muted">
              {alerts.length} alert{alerts.length === 1 ? "" : "s"} armed on this device — they fire while
              the dashboard is open.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

/** Fires armed alerts. Kept beside the store it reads so the two cannot drift. */
export function useAlertWatch(pair: string, price: number, decimals: number) {
  useEffect(() => {
    if (!price || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let list: Alert[] = [];
    try { list = JSON.parse(localStorage.getItem(ALERT_KEY) ?? "[]"); } catch { return; }

    const hit = list.filter((a) => a.pair === pair && Math.abs(a.price - price) / price < 0.0004);
    if (!hit.length) return;

    for (const a of hit) {
      new Notification(`${pair} reached ${a.price.toFixed(decimals)}`, {
        body: `Now ${price.toFixed(decimals)} — GFXA Terminal`,
        tag: `${pair}-${a.price}`,
      });
    }
    // Consumed, so one crossing does not notify on every poll.
    const rest = list.filter((a) => !hit.includes(a));
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(rest)); } catch { /* private mode */ }
  }, [pair, price, decimals]);
}
