"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Mic, X } from "lucide-react";
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
      close?: () => unknown;
    };
  }
}

const TOKEN = process.env.NEXT_PUBLIC_HIRESTELLA_TOKEN || "emb_Fp6YyGFWki6RWZZtqcd0oFmRx5oIRrcHhkbiv5ZxdbM";
const API = process.env.NEXT_PUBLIC_HIRESTELLA_API || "https://voice.hirestella.ai";
const SCRIPT_ID = "dograh-widget";
const CTA_ID = "dograh-widget-cta";
const SEEN_KEY = "dograh-welcome-shown";

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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  /* ---------------------------------------------------------------- panel */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const startCall = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      // Same user gesture the microphone prompt needs.
      await window.DograhWidget?.start?.();
      setOpen(false);
    } catch {
      setError("Could not start the call. Check that the browser has microphone access.");
    } finally {
      setStarting(false);
    }
  }, []);

  if (blocked) return null;

  return (
    <>
      {/* ----------------------------------------------------- welcome tip */}
      {tip && !open ? (
        <button
          type="button"
          onClick={() => setTip(false)}
          className="fixed bottom-[76px] right-5 z-[999998] max-w-[250px] animate-riseIn rounded-lg border border-[#00ff88] bg-[#00ff88] px-3 py-2 text-left font-mono text-[12px] font-bold leading-snug text-[#0a0a0a] shadow-[0_8px_24px_rgba(0,255,136,0.3)] lg:bottom-[72px]"
        >
          👋 Questions about the Dubai event? Ask me.
          <span aria-hidden className="absolute -bottom-[7px] right-7 h-3 w-3 rotate-45 bg-[#00ff88]" />
        </button>
      ) : null}

      {/* -------------------------------------------------------- our panel */}
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[999997] cursor-default bg-black/50 backdrop-blur-[6px] animate-fadeIn"
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="GFXA AI assistant"
            className="fixed bottom-4 right-4 z-[1000000] w-[min(360px,calc(100vw-2rem))] origin-bottom-right animate-popIn overflow-hidden rounded-3xl border-2 border-[#00ff88] bg-[#0a0a0a] shadow-[0_20px_60px_rgba(0,255,136,0.2)] outline-none sm:bottom-6 sm:right-6"
          >
            <header className="flex items-center gap-2.5 border-b border-[#262626] bg-[#141414] px-4 py-3">
              <Image src={logo} alt="" aria-hidden height={26} width={Math.round(26 * logo.width / logo.height)} className="h-[26px] w-auto" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#00ff88]">
                  <span className="text-[#00ff88]/50">_&gt;</span> GFXA AI ASSISTANT
                </p>
                <p className="truncate font-mono text-[10px] text-[#a3a3a3]">voice · answers in English</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[#525252] transition-colors hover:text-[#e5e5e5]">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-3 px-4 py-4">
              <p className="text-[12.5px] leading-relaxed text-[#e5e5e5]">Ask about the event, your QR code, the leaderboard or the markets.</p>
              <ul className="space-y-1.5 font-mono text-[11.5px] leading-relaxed text-[#a3a3a3]">
                <li className="flex gap-2"><span className="text-[#00ff88]">›</span> “Where is the Dubai event?”</li>
                <li className="flex gap-2"><span className="text-[#00ff88]">›</span> “How do I get my QR code?”</li>
                <li className="flex gap-2"><span className="text-[#00ff88]">›</span> “What is the GFXA score?”</li>
              </ul>

              <button
                type="button"
                onClick={() => void startCall()}
                disabled={starting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00ff88] px-4 py-2.5 font-mono text-[12.5px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
              >
                <Mic className="h-4 w-4" strokeWidth={2.4} />
                {starting ? "Connecting…" : "_> Start voice chat"}
              </button>

              {error ? <p className="font-mono text-[11px] leading-relaxed text-[#ff4d4d]">{error}</p> : null}

              <p className="font-mono text-[10px] leading-relaxed text-[#525252]">
                Your microphone is used only while the call is running, and the call is handled by Hirestella, not by this
                site. Educational only — not financial advice.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
