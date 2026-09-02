"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NAV_LINKS, SPY_ORDER, type NavLink } from "@/lib/links";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  /*
   * Both the bar background and the scroll-spy run on IntersectionObserver
   * rather than a scroll listener: IO is driven by the compositor, so it needs
   * no per-frame work and keeps reporting correctly in embedded/automated
   * webviews where scroll events are not dispatched.
   */
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const sections = SPY_ORDER.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (!sections.length) return;

    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        // SPY_ORDER is document order: the deepest visible section wins.
        let current: string | null = null;
        for (const id of SPY_ORDER) if (visible.has(id)) current = id;
        setActive(current);
      },
      // A band starting just under the sticky bar, so a section becomes active
      // as its heading clears the navbar.
      { rootMargin: "-88px 0px -62% 0px", threshold: 0 }
    );

    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const onNavClick = useCallback((link: NavLink) => {
    setOpen(false);
    if (link.event) window.dispatchEvent(new CustomEvent(link.event));
  }, []);

  return (
    <>
      {/* Sits 12px down the document; once it scrolls out of view the bar solidifies. */}
      <div ref={sentinel} aria-hidden className="absolute left-0 top-3 h-px w-px" />

      <header
      style={{ top: "var(--gfxa-banner-h, 0px)" }}
      className={`fixed inset-x-0 z-50 transition-all duration-200 ${
        scrolled
          ? "border-b border-white/[0.08] bg-[rgba(7,10,18,0.72)] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="GLOBAL FX ALLIANCE home">
          <Logo size={36} wordmarkClass="text-[15px]" />
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => {
            const isActive = active === l.spy;
            return (
              <a
                key={l.label}
                href={l.href}
                onClick={() => onNavClick(l)}
                aria-current={isActive ? "true" : undefined}
                className={`relative text-[14px] font-medium transition-colors duration-200 ${
                  isActive ? "text-brand-blue" : "text-ink-muted hover:text-white"
                }`}
              >
                {l.label}
                <span
                  className={`absolute -bottom-1.5 left-0 h-[2px] rounded-full bg-brand-blue transition-all duration-200 ${
                    isActive ? "w-full opacity-100" : "w-0 opacity-0"
                  }`}
                />
              </a>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/dashboard?ref=login"
            className="px-3 py-2 text-[14px] font-medium text-ink-muted transition-colors duration-200 hover:text-white"
          >
            Login
          </Link>
          <Link href="/dashboard?ref=nav" className="btn-primary !px-5 !py-2.5 text-[13px]">
            JOIN THE ALLIANCE
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-white/[0.08] bg-[rgba(7,10,18,0.97)] backdrop-blur-xl lg:hidden">
          <div className="flex flex-col gap-1 px-5 py-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => onNavClick(l)}
                aria-current={active === l.spy ? "true" : undefined}
                className={`rounded-lg px-3 py-3 text-[15px] font-medium transition-colors duration-200 ${
                  active === l.spy
                    ? "bg-brand-blue/[0.12] text-brand-blue"
                    : "text-ink-muted hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/dashboard?ref=login"
                className="btn-ghost w-full"
                onClick={() => setOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/dashboard?ref=nav"
                className="btn-primary w-full"
                onClick={() => setOpen(false)}
              >
                JOIN THE ALLIANCE
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      </header>
    </>
  );
}
