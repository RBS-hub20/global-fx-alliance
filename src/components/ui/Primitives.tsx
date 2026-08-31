"use client";

import { useEffect, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

/* ---------------------------------------------------------------- panel shell */

export function PanelHeader({
  title,
  action,
  live,
}: {
  title: string;
  action?: ReactNode;
  live?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-white">
        {title}
        {live ? <LiveDot /> : null}
      </h2>
      {action}
    </div>
  );
}

export function LiveDot({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-60 animate-pulseRing" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
      </span>
      {label}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl glass ${className}`}>{children}</section>;
}

export function CardHead({
  title,
  right,
  icon: Icon,
}: {
  title: string;
  right?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
      <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-white">
        {Icon ? <Icon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} /> : null}
        {title}
      </h3>
      {right}
    </header>
  );
}

/* ------------------------------------------------------------------- controls */

export function Pills<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: readonly T[] | { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const norm = options.map((o) =>
    typeof o === "string" ? { value: o as T, label: o as string } : o
  );
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1">
      {norm.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`shrink-0 rounded-full border transition-all duration-200 ${
              size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]"
            } font-semibold ${
              on
                ? "border-brand-blue/50 bg-brand-blue/[0.15] text-brand-blue shadow-glow"
                : "border-white/[0.08] bg-white/[0.03] text-ink-muted hover:border-brand-blue/30 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 py-3">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-ink-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-all duration-200 ${
          checked
            ? "border-brand-blue/50 bg-brand-blue/70 shadow-glow"
            : "border-white/[0.1] bg-white/[0.06]"
        }`}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-all duration-200 ${
            checked ? "left-[24px]" : "left-[3px]"
          }`}
        />
      </button>
    </label>
  );
}

export function Field({
  label,
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <span className="relative block">
        <input
          {...props}
          className="h-11 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 pr-12 text-[14px] num-mono text-ink outline-none transition-all duration-200 placeholder:text-ink-muted/60 focus:border-brand-blue/40 focus:bg-white/[0.05] focus:shadow-glow"
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">
            {suffix}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <select
        {...props}
        className="h-11 w-full rounded-lg border border-white/[0.08] bg-[#0E1526] px-3 text-[14px] text-ink outline-none transition-all duration-200 focus:border-brand-blue/40 focus:shadow-glow"
      >
        {children}
      </select>
    </label>
  );
}

/* --------------------------------------------------------------- states/modal */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-brand-blue">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <h3 className="mt-5 text-[15px] font-bold text-white">{title}</h3>
      <p className="mt-2 max-w-[42ch] text-[13.5px] leading-relaxed text-ink-muted">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-white/[0.04] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
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
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative my-auto w-full rounded-2xl border border-white/[0.1] bg-[rgba(12,18,32,0.97)] shadow-glow-lg backdrop-blur-xl animate-riseIn ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-6 py-4">
          <h3 className="text-[15px] font-bold tracking-tight text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-ink-muted transition-colors duration-200 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-brand-green/40 bg-[rgba(6,32,26,0.95)] px-5 py-3 text-[13px] font-semibold text-brand-green shadow-glow-green backdrop-blur-xl animate-riseIn lg:bottom-8"
    >
      {message}
    </div>
  );
}

/* ---------------------------------------------------------------- formatting */

export function Change({ pct, className = "" }: { pct: number; className?: string }) {
  const up = pct >= 0;
  return (
    <span
      className={`num-mono rounded-full px-2 py-0.5 text-[12px] font-semibold ${
        up ? "bg-brand-green/[0.13] text-brand-green" : "bg-brand-danger/[0.13] text-brand-danger"
      } ${className}`}
    >
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

export function money(n: number, digits = 2): string {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
