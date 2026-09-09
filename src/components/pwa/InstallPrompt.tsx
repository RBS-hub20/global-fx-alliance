"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { readStore, writeStore } from "@/lib/storage";

/**
 * Install invitation.
 *
 * Android and desktop Chrome fire `beforeinstallprompt`, so there the browser's
 * own installer is used. iOS Safari fires nothing and has no programmatic
 * install at all — the only route is Share → Add to Home Screen — so on iOS this
 * shows the instruction instead of a button that could not work. A dead
 * "Install" button on iPhone is worse than no banner.
 *
 * It stays hidden once installed, once dismissed, and whenever the app is
 * already running standalone.
 */

const DISMISS_KEY = "gfxa-install-dismissed";

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS exposes it here and nowhere else.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function isIos(): boolean {
  try {
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    if (isStandalone() || readStore<boolean>(DISMISS_KEY, false)) return;

    setGone(false);
    if (isIos()) setIosHint(true);

    const onPrompt = (e: Event) => {
      // Keeping the event is what allows the button to trigger the real
      // installer later; without this the browser's own prompt is lost.
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => { setGone(true); writeStore(DISMISS_KEY, true); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => { setGone(true); writeStore(DISMISS_KEY, true); };

  // Nothing to offer: not iOS, and the browser never said it could install.
  if (gone || (!deferred && !iosHint)) return null;

  return (
    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-brand-blue/25 bg-brand-blue/[0.06] px-4 py-3 pr-10">
      <Smartphone className="h-4 w-4 shrink-0 text-brand-blue" strokeWidth={2} />
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
        <span className="font-semibold text-white">Add GFXA to your home screen.</span>{" "}
        {iosHint ? (
          <>
            Tap <Share className="mx-0.5 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={2} /> Share, then
            <span className="font-medium text-white"> Add to Home Screen</span>.
          </>
        ) : (
          <>Opens full screen and keeps your journal and streak on this device.</>
        )}
      </p>

      {deferred ? (
        <button
          type="button"
          onClick={async () => {
            try {
              await deferred.prompt();
              const { outcome } = await deferred.userChoice;
              if (outcome === "accepted") setGone(true);
            } catch {
              /* the browser declined to show it */
            } finally {
              setDeferred(null);
            }
          }}
          className="btn-primary !py-1.5 text-[12px]"
        >
          Install
        </button>
      ) : null}

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
