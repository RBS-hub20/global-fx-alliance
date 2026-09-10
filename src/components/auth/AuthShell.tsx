import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/** The dark frame every auth screen sits in, matching the dashboard surface. */
export function AuthShell({ title, blurb, children, footer }: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070A12] px-5 py-12">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex justify-center"><Logo size={34} /></Link>
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-6">
          <h1 className="text-[17px] font-semibold text-white">{title}</h1>
          {blurb ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{blurb}</p> : null}
          <div className="mt-5">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-[12.5px] text-ink-muted">{footer}</div> : null}
      </div>
    </main>
  );
}

export function Field({
  label, type = "text", value, onChange, placeholder, autoComplete, required = true, hint,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; required?: boolean; hint?: string;
}) {
  return (
    <label className="mb-3.5 flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-brand-blue/50"
      />
      {hint ? <span className="text-[11px] text-ink-muted/70">{hint}</span> : null}
    </label>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "wait"; children: React.ReactNode }) {
  const style =
    tone === "error" ? "border-brand-danger/30 bg-brand-danger/[0.07] text-brand-danger"
    : tone === "ok" ? "border-brand-green/30 bg-brand-green/[0.07] text-brand-green"
    : "border-[#fbbf24]/30 bg-[#fbbf24]/[0.07] text-[#fbbf24]";
  return <p role="status" className={`mt-3 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed ${style}`}>{children}</p>;
}
