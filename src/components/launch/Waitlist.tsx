"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ArrowRight, Check, Loader2, Rocket, X } from "lucide-react";
import { COPY, WAITLIST_BENEFITS } from "@/lib/launch";
import { EVENTS, trackEvent } from "@/lib/analytics";
import { hasJoined, isValidEmail, saveEntry, submitEmail } from "@/lib/waitlist";

type Status = "idle" | "sending" | "done" | "error";

/*
 * Both forms are `noValidate`. The email inputs are `type="email"`, so without
 * it the browser's own constraint validation blocks submit and shows a native
 * tooltip — which means the styled, accessible inline error below never renders
 * and isValidEmail never runs. Our validator owns the message.
 */

/** Shared submit path for the modal, the banner and the footer form. */
function useWaitlist(source: string) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (status === "sending") return;
    if (company.trim() !== "") {
      // Bot filled the hidden field. Show success and do nothing.
      setStatus("done");
      return;
    }
    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage("That doesn't look like a valid email address.");
      return;
    }

    setStatus("sending");
    setMessage(null);
    const res = await submitEmail(email);
    if (!res.ok) {
      setStatus("error");
      setMessage(res.message ?? "Please try again in a moment.");
      return;
    }

    saveEntry(email);
    trackEvent(EVENTS.waitlistSignup, { source });
    setStatus("done");
    setMessage("You're on the list. We'll email your founding-member invite.");
  }, [company, email, source, status]);

  return { email, setEmail, company, setCompany, status, message, submit };
}

function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden>
      <label>
        Company
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function WaitlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email, setEmail, company, setCompany, status, message, submit } = useWaitlist("modal");
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-brand-blue/30 bg-[rgba(12,18,32,0.98)] shadow-glow-lg animate-riseIn"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand-blue/20 blur-3xl" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-muted transition-colors duration-200 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-brand-blue">
            <Rocket className="h-3 w-3" strokeWidth={2.4} />
            Pre-launch
          </span>

          <h2 id={`${inputId}-title`} className="headline mt-4 text-[24px] leading-tight">
            {COPY.waitlistHeadline}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{COPY.waitlistSub}</p>

          <ul className="mt-6 space-y-2.5">
            {WAITLIST_BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-blue/20">
                  <Check className="h-2.5 w-2.5 text-brand-blue" strokeWidth={3} />
                </span>
                {b}
              </li>
            ))}
          </ul>

          {status === "done" ? (
            <div className="mt-7 flex items-center gap-3 rounded-xl border border-brand-green/40 bg-brand-green/[0.1] px-4 py-4">
              <Check className="h-5 w-5 shrink-0 text-brand-green" strokeWidth={2.6} />
              <p className="text-[13.5px] text-brand-green">{message}</p>
            </div>
          ) : (
            <form className="mt-7" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Honeypot value={company} onChange={setCompany} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={inputId}
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  aria-invalid={status === "error"}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3.5 text-[14px] text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/50 focus:shadow-glow"
                />
                <button type="submit" disabled={status === "sending"} className="btn-primary shrink-0 !py-2.5 disabled:opacity-50">
                  {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Join<ArrowRight className="h-4 w-4" strokeWidth={2.2} /></>)}
                </button>
              </div>
              {status === "error" && message ? <p role="alert" className="mt-2 text-[12.5px] text-brand-danger">{message}</p> : null}
              <p className="mt-3 text-[11px] leading-relaxed text-ink-muted/70">
                Your address is kept on this device. No account is created and nothing is shared.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function WaitlistBanner() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);

  // Only after mount, so server and client markup match and joiners aren't nagged.
  useEffect(() => {
    setShow(!hasJoined());
  }, []);

  if (!show) return null;

  return (
    <>
      <div className="relative z-[45] border-b border-brand-blue/20 bg-gradient-to-r from-[#0A1931] via-[#102a52] to-[#0A1931]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-center lg:px-8">
          <Rocket className="h-3.5 w-3.5 shrink-0 text-brand-blue" strokeWidth={2.2} />
          <span className="text-[13px] text-ink">GFXA Pro is launching soon — founding members get early access.</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-brand-blue/40 bg-brand-blue/[0.12] px-3 py-1 text-[12px] font-semibold text-brand-blue transition-all duration-200 hover:bg-brand-blue/20 hover:shadow-glow"
          >
            Join the waitlist
            <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => setShow(false)}
            aria-label="Dismiss"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <WaitlistModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function WaitlistInline() {
  const { email, setEmail, company, setCompany, status, message, submit } = useWaitlist("footer");

  if (status === "done") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-brand-green">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
        {message}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Honeypot value={company} onChange={setCompany} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address for the launch list"
          aria-invalid={status === "error"}
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-[13px] text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/50"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-[12.5px] font-semibold text-white transition-all duration-200 hover:bg-[#4A93FF] hover:shadow-glow disabled:opacity-50"
        >
          {status === "sending" ? "…" : "Join"}
        </button>
      </div>
      {status === "error" && message ? <p role="alert" className="mt-1.5 text-[11.5px] text-brand-danger">{message}</p> : null}
    </form>
  );
}
