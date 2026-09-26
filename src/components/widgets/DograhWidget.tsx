"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Mic, PhoneOff, RotateCcw, X } from "lucide-react";
import logo from "../../../public/brand/gfxa-logo-trim.png";

/**
 * Hirestella / Dograh voice widget, plus the GFXA panel that fronts it.
 *
 * The embed is configured server-side as widgetType "voice", embedMode
 * "floating" (GET /api/v1/public/embed/config/<token>). In that mode the script
 * renders exactly one element — the launcher button — and clicking it dials
 * straight away; its own openWidget() is a documented no-op because the vendor
 * removed the modal. There is no chat window, header or panel of theirs to
 * restyle.
 *
 * So the panel below is ours: a normal React modal in the terminal palette that
 * intercepts the launcher, says what the assistant can answer, and then calls
 * the widget's public start() on a real user gesture (microphone permission
 * needs one). The launcher itself is recoloured in globals.css.
 *
 * Trust note: an embedded widget runs with our own privileges — DOM, the
 * Supabase session cookie, anything typed into a form. It is kept off every
 * route with a password field.
 */

declare global {
  interface Window {
    DograhWidget?: {
      setContext?: (vars: Record<string, string>) => unknown;
      start?: () => unknown;
      stop?: () => unknown;
      retry?: () => unknown;
      close?: () => unknown;
      onCallStart?: (cb: () => void) => void;
      onCallConnected?: (cb: () => void) => void;
      onCallDisconnected?: (cb: () => void) => void;
      onCallEnd?: (cb: () => void) => void;
      onError?: (cb: (e: unknown) => void) => void;
    };
  }
}

const TOKEN = process.env.NEXT_PUBLIC_HIRESTELLA_TOKEN || "emb_Fp6YyGFWki6RWZZtqcd0oFmRx5oIRrcHhkbiv5ZxdbM";
const API = process.env.NEXT_PUBLIC_HIRESTELLA_API || "https://voice.hirestella.ai";
const SCRIPT_ID = "dograh-widget";
const CTA_ID = "dograh-widget-cta";
const SEEN_KEY = "dograh-welcome-shown";

type Phase = "idle" | "connecting" | "live" | "ended" | "error";

/** Routes with a password field. Empty this array to load it everywhere. */
const EXCLUDED_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password"];
/** The VT Bridge form on this tab takes an MT5 password. */
const EXCLUDED_TABS = ["ai-bot"];

/** Live-call states the vendor sets on the launcher; a click then ends the call. */
const BUSY = ["dograh-state-connecting", "dograh-state-connected"];

function contextFor(pathname: string): Record<string, string> {
  return {
    page_url: window.location.href,
    path: pathname,
    today: new Date().toISOString().slice(0, 10),
    event_code: "GFXA2026",
    community: "GFXA COMMUNITY",
  };
}

export function DograhWidget() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState<number | undefined>(undefined);

  const blocked =
    EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    (pathname.startsWith("/dashboard") && !!tab && EXCLUDED_TABS.includes(tab));

  /* ------------------------------------------------------------ the script */

  useEffect(() => {
    const root = () => document.getElementById("dograh-widget-root");

    /*
     * Skipping the load only covers a direct landing. Reaching a password page
     * from inside the app is a client-side navigation, and the widget loaded on
     * the previous page would still be sitting there — so it is hidden too.
     */
    if (blocked) {
      const r = root();
      if (r) { window.DograhWidget?.close?.(); r.style.display = "none"; }
      setOpen(false);
      setTip(false);
      return;
    }

    const shown = root();
    if (shown) shown.style.display = "";

    const onDashboard = pathname.startsWith("/dashboard");
    if (onDashboard) document.body.dataset.bottomNav = "1";
    else delete document.body.dataset.bottomNav;

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      // data-dograh-context is read once at init, so a route change needs the
      // published setContext(), which merges into the next conversation.
      existing.setAttribute("data-dograh-context", JSON.stringify(contextFor(pathname)));
      window.DograhWidget?.setContext?.(contextFor(pathname));
      return;
    }

    const js = document.createElement("script");
    js.id = SCRIPT_ID;
    js.src = `${API}/embed/dograh-widget.js?token=${encodeURIComponent(TOKEN)}&environment=production&apiEndpoint=${encodeURIComponent(API)}`;
    js.setAttribute("data-dograh-context", JSON.stringify(contextFor(pathname)));
    js.async = true;
    document.body.appendChild(js);
  }, [pathname, blocked]);

  /* -------------------------------------------------- intercept the launcher */

  useEffect(() => {
    if (blocked) return;

    const onClick = (e: MouseEvent) => {
      const cta = (e.target as HTMLElement | null)?.closest?.(`#${CTA_ID}`);
      if (!cta) return;
      // A call in progress: let the vendor's own handler end it.
      if (BUSY.some((c) => cta.classList.contains(c))) return;
      e.preventDefault();
      e.stopPropagation();
      setError(null);
      setTip(false);
      setOpen(true);
    };

    // Capture phase: the vendor binds onclick on the button itself, and this
    // has to run first to keep a click from dialling before the panel is seen.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [blocked]);

  /* ------------------------------------------------------- welcome tooltip */

  useEffect(() => {
    if (blocked || pathname !== "/") return;
    try { if (localStorage.getItem(SEEN_KEY)) return; } catch { return; }

    const show = setTimeout(() => {
      if (!document.getElementById(CTA_ID)) return;
      setTip(true);
      try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ }
    }, 3000);
    const hide = setTimeout(() => setTip(false), 8000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [pathname, blocked]);

  /* --------------------------------------------------- call lifecycle */

  /*
   * The vendor publishes call callbacks, so the panel can follow the real call
   * instead of guessing from the button. They are registered once the script
   * has defined its API; onStatusChange is not used because in floating mode it
   * only fires for headless embeds.
   */
  useEffect(() => {
    if (blocked) return;
    let alive = true;

    const attach = () => {
      const w = window.DograhWidget;
      if (!w?.onCallStart) return false;
      w.onCallStart?.(() => alive && setPhase("connecting"));
      w.onCallConnected?.(() => { if (alive) { setSeconds(0); setPhase("live"); } });
      w.onCallDisconnected?.(() => alive && setPhase((p) => (p === "error" ? p : "ended")));
      w.onCallEnd?.(() => alive && setPhase((p) => (p === "error" ? p : "ended")));
      w.onError?.(() => {
        if (!alive) return;
        setError("The call dropped. You can try again.");
        setPhase("error");
      });
      return true;
    };

    if (attach()) return () => { alive = false; };
    const id = setInterval(() => { if (attach()) clearInterval(id); }, 400);
    return () => { alive = false; clearInterval(id); };
  }, [blocked]);

  // Elapsed time, and the flag that hides the vendor button while we own the UI.
  useEffect(() => {
    const busy = phase === "connecting" || phase === "live";
    if (busy) { document.body.dataset.gfxaCall = "1"; setOpen(true); }
    else delete document.body.dataset.gfxaCall;
    if (phase !== "live") return;
    const id = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Height morphs between states rather than jumping.
  useEffect(() => {
    if (!open || !bodyRef.current) return;
    const el = bodyRef.current;
    const ro = new ResizeObserver(() => setBodyHeight(el.scrollHeight));
    ro.observe(el);
    setBodyHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, [open, phase, error]);

  const startCall = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      // Same user gesture the microphone prompt needs.
      await window.DograhWidget?.start?.();
    } catch {
      setError("Could not start the call. Check that the browser has microphone access.");
      setPhase("error");
    }
  }, []);

  const endCall = useCallback(() => {
    try { window.DograhWidget?.stop?.(); } catch { /* already gone */ }
    setPhase("ended");
  }, []);

  const closePanel = useCallback(() => {
    if (phase === "connecting" || phase === "live") endCall();
    setOpen(false);
    setPhase("idle");
    setError(null);
  }, [phase, endCall]);

  /* ---------------------------------------------------------------- panel */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  if (blocked) return null;

  const busy = phase === "connecting" || phase === "live";
  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <>
      {/* ----------------------------------------------------- welcome tip */}
      {tip && !open ? (
        <button
          type="button"
          onClick={() => setTip(false)}
          className="gfxa-tip fixed bottom-[76px] right-5 z-[999998] max-w-[240px] rounded-lg border border-[#00ff88] bg-[#00ff88] px-3 py-2 text-left font-mono text-[12px] font-bold leading-snug text-[#0a0a0a] shadow-[0_8px_24px_rgba(0,255,136,0.3)] lg:bottom-[72px]"
        >
          👋 Questions about the Dubai event?
          <span aria-hidden className="absolute -bottom-[7px] right-7 h-3 w-3 rotate-45 bg-[#00ff88]" />
        </button>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={closePanel}
            className="animate-fadeIn fixed inset-0 z-[999997] cursor-default bg-black/55 backdrop-blur-[6px]"
          />

          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="GFXA AI assistant"
            className="animate-popIn fixed bottom-4 right-4 z-[1000000] w-[min(340px,calc(100vw-2rem))] origin-bottom-right overflow-hidden rounded-3xl border border-[#00ff88]/70 bg-[#0a0a0a] shadow-[0_24px_70px_rgba(0,255,136,0.18)] outline-none sm:bottom-6 sm:right-6"
          >
            {/* A hairline of brand green across the top, and a live pulse while talking. */}
            <span aria-hidden className={`block h-[2px] w-full bg-gradient-to-r from-transparent via-[#00ff88] to-transparent ${busy ? "gfxa-scan" : ""}`} />

            <header className="flex items-center gap-2.5 px-4 pb-3 pt-3.5">
              <Image src={logo} alt="" aria-hidden height={24} width={Math.round(24 * logo.width / logo.height)} className="h-6 w-auto" />
              <p className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#00ff88]">
                <span className="text-[#00ff88]/50">_&gt;</span> GFXA AI
              </p>
              <button type="button" onClick={closePanel} aria-label="Close"
                className="-mr-1 rounded p-1 text-[#525252] transition-colors hover:bg-[#1a1a1a] hover:text-[#e5e5e5]">
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Height animates between states instead of snapping. */}
            <div className="gfxa-morph overflow-hidden" style={{ height: bodyHeight }}>
              <div ref={bodyRef} className="px-4 pb-4">
                {phase === "idle" ? (
                  <div key="idle" className="gfxa-enter space-y-3">
                    <p className="text-[13px] leading-relaxed text-[#e5e5e5]" style={{ animationDelay: "40ms" }}>
                      Ask about the Dubai event, your QR code or the leaderboard.
                    </p>
                    <div className="flex flex-wrap gap-1.5" style={{ animationDelay: "90ms" }}>
                      {["Where is the event?", "Get my QR code", "What is GFXA score?"].map((q) => (
                        <span key={q} className="rounded-full border border-[#262626] px-2.5 py-1 font-mono text-[10.5px] text-[#a3a3a3] transition-colors hover:border-[#00ff88]/40 hover:text-[#e5e5e5]">
                          {q}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={() => void startCall()} style={{ animationDelay: "140ms" }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00ff88] px-4 py-2.5 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:scale-[0.98]">
                      <Mic className="h-4 w-4" strokeWidth={2.4} /> Start voice chat
                    </button>
                    <p className="text-center font-mono text-[9.5px] text-[#525252]" style={{ animationDelay: "180ms" }}>
                      Mic on only during the call · handled by Hirestella
                    </p>
                  </div>
                ) : null}

                {busy ? (
                  <div key="busy" className="gfxa-enter flex flex-col items-center gap-3 py-2 text-center">
                    <span className="relative flex h-16 w-16 items-center justify-center">
                      <span className="gfxa-ring absolute inset-0 rounded-full border border-[#00ff88]/50" />
                      <span className="gfxa-ring absolute inset-0 rounded-full border border-[#00ff88]/50" style={{ animationDelay: "700ms" }} />
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00ff88] text-[#0a0a0a]">
                        <Mic className="h-5 w-5" strokeWidth={2.4} />
                      </span>
                    </span>

                    {phase === "live" ? (
                      <span aria-hidden className="flex h-5 items-end gap-[3px]">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <span key={i} className="gfxa-bar w-[3px] rounded-full bg-[#00ff88]" style={{ animationDelay: `${i * 110}ms` }} />
                        ))}
                      </span>
                    ) : null}

                    <div>
                      <p className="font-mono text-[12.5px] font-bold uppercase tracking-[0.1em] text-[#00ff88]">
                        {phase === "connecting" ? "Connecting…" : "Live"}
                      </p>
                      <p className="num-mono mt-0.5 text-[11px] text-[#a3a3a3]">
                        {phase === "connecting" ? "Allow the microphone when asked" : mmss}
                      </p>
                    </div>

                    <button type="button" onClick={endCall}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#ff4d4d]/50 bg-[#ff4d4d]/10 px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#ff4d4d] transition-colors hover:bg-[#ff4d4d]/20">
                      <PhoneOff className="h-4 w-4" strokeWidth={2.2} /> End call
                    </button>
                  </div>
                ) : null}

                {phase === "ended" ? (
                  <div key="ended" className="gfxa-enter flex flex-col items-center gap-3 py-2 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]">
                      <Check className="h-6 w-6" strokeWidth={2.6} />
                    </span>
                    <div>
                      <p className="font-mono text-[12.5px] font-bold uppercase tracking-[0.1em] text-[#e5e5e5]">Call ended</p>
                      {seconds > 0 ? <p className="num-mono mt-0.5 text-[11px] text-[#a3a3a3]">{mmss}</p> : null}
                    </div>
                    <div className="flex w-full gap-2">
                      <button type="button" onClick={() => void startCall()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#00ff88] px-3 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all duration-200 hover:brightness-110 active:scale-[0.98]">
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} /> Again
                      </button>
                      <button type="button" onClick={closePanel}
                        className="rounded-lg border border-[#262626] px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors hover:text-[#e5e5e5]">
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}

                {phase === "error" ? (
                  <div key="error" className="gfxa-enter space-y-3">
                    <p className="rounded-lg border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[#ff4d4d]">
                      {error ?? "Something went wrong."}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void startCall()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#00ff88] px-3 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all duration-200 hover:brightness-110">
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} /> Try again
                      </button>
                      <button type="button" onClick={closePanel}
                        className="rounded-lg border border-[#262626] px-4 py-2.5 font-mono text-[12px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors hover:text-[#e5e5e5]">
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
