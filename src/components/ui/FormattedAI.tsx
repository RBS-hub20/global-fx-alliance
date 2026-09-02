import type { ReactNode } from "react";

/**
 * Renders the small slice of markdown the assistant actually emits.
 *
 * Not react-markdown: that pulls remark and mdast for roughly 40 kB gzipped, and
 * the model only ever produces `**bold**`, backtick code, `- ` bullets and rule
 * lines. This handles those in about eighty lines with no dependency.
 *
 * Two refinements over a plain bold swap:
 *
 * - A line that *opens* with a short bold phrase ending in a full stop or colon
 *   is a section heading ("**Bakit ganito.** Ang structure ay…"), so it is
 *   rendered as one rather than as a bold run inside a paragraph.
 * - Only bold spans containing a digit get the pill treatment. Pilling every
 *   bold span turns a paragraph into a ransom note; pilling the figures makes
 *   4335.04 and -$68.80 findable at a glance, which is the point.
 */

export type AiTone = "panel" | "terminal";

interface Props {
  text: string;
  /** `terminal` keeps the assistant's green-on-black palette. */
  tone?: AiTone;
  className?: string;
}

const TONE = {
  panel: {
    body: "text-ink-muted",
    heading: "text-white",
    pill: "bg-white/[0.08] text-white",
    pillNeg: "bg-brand-danger/[0.12] text-brand-danger",
    strong: "text-white",
    code: "bg-brand-blue/10 text-brand-blue",
    bullet: "bg-brand-blue",
    rule: "bg-white/10",
  },
  terminal: {
    body: "text-[#c8d0dc]",
    heading: "text-[#00ff88]",
    pill: "bg-[#fbbf24]/[0.14] text-[#fbbf24]",
    pillNeg: "bg-[#FF4D4D]/[0.14] text-[#FF4D4D]",
    strong: "text-[#fbbf24]",
    code: "bg-[#00ff88]/10 text-[#00ff88]",
    bullet: "bg-[#00ff88]",
    rule: "bg-[#00ff88]/15",
  },
} as const;

const HEADING = /^\*\*(.{1,44}?[.:])\*\*\s*/;
const hasFigure = (s: string) => /\d/.test(s);
/** A losing figure reads as one — "-$68.80" and "-1.31%" carry their sign in colour. */
const isNegative = (s: string) => /^-\s*[$€£¥]?\d/.test(s.trim());

/** Bold, code and plain runs within one line. */
function inline(text: string, t: (typeof TONE)[AiTone], keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return hasFigure(inner) ? (
        <strong
          key={key}
          className={`num-mono rounded px-1 py-[1px] font-semibold ${isNegative(inner) ? t.pillNeg : t.pill}`}
        >
          {inner}
        </strong>
      ) : (
        <strong key={key} className={`font-semibold ${t.strong}`}>{inner}</strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key} className={`rounded px-1 ${t.code}`}>{part.slice(1, -1)}</code>;
    }
    return <span key={key}>{part}</span>;
  });
}

export function FormattedAI({ text, tone = "panel", className = "" }: Props) {
  const t = TONE[tone];

  return (
    <div className={`space-y-2 text-[12.5px] leading-6 ${t.body} ${className}`}>
      {text.split("\n").map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1.5" aria-hidden />;
        if (/^-{3,}$/.test(line)) return <div key={i} className={`my-2 h-px ${t.rule}`} aria-hidden />;

        // "**Ano ang nakikita.** rest of the sentence" — heading plus body.
        const head = line.match(HEADING);
        if (head) {
          const rest = line.slice(head[0].length);
          return (
            <div key={i} className="pt-1.5 first:pt-0">
              <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.09em] ${t.heading}`}>
                {head[1].replace(/[.:]$/, "")}
              </p>
              {rest ? <p>{inline(rest, t, String(i))}</p> : null}
            </div>
          );
        }

        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className={`mt-[9px] h-1 w-1 shrink-0 rounded-full ${t.bullet}`} aria-hidden />
              <span>{inline(line.slice(2), t, String(i))}</span>
            </div>
          );
        }

        return <p key={i}>{inline(line, t, String(i))}</p>;
      })}
    </div>
  );
}
