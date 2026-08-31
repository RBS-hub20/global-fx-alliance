"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Eraser, FileText, Lightbulb, Sparkles } from "lucide-react";
import { Card, CardHead, PanelHeader, Select, Toast } from "@/components/ui/Primitives";
import { SUMMARY, answer, tradeIdea } from "@/lib/ai";
import { PAIRS } from "@/lib/market";
import { AI_CHIPS } from "@/lib/data";
import { KEYS, usePersistentState } from "@/lib/storage";

interface Msg {
  role: "user" | "ai";
  text: string;
}

const GREETING: Msg = {
  role: "ai",
  text: "Ask me about a pair, today's calendar, or what is driving the dollar. I explain structure — I don't hand out signals.",
};

/** Renders **bold** and `- ` bullets; the assistant only ever emits those two. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <span key={i} className="block h-2.5" />;
        const bullet = line.startsWith("- ");
        const content = bullet ? line.slice(2) : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="font-semibold text-white">{p.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{p}</span>
          )
        );
        return bullet ? (
          <span key={i} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-blue" aria-hidden />
            <span>{rendered}</span>
          </span>
        ) : (
          <span key={i} className="block">{rendered}</span>
        );
      })}
    </>
  );
}

export function AiToolsPanel() {
  const { value: history, setValue: setHistory, hydrated } = usePersistentState<Msg[]>(
    KEYS.chat,
    [GREETING]
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [idea, setIdea] = useState<string | null>(null);
  const [ideaPair, setIdeaPair] = useState("EUR/USD");
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [history, thinking]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setHistory((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    // Small delay so the exchange reads as a conversation rather than a lookup.
    window.setTimeout(() => {
      setHistory((prev) => [...prev, { role: "ai", text: answer(q) }]);
      setThinking(false);
    }, 420);
  };

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="space-y-6">
      <PanelHeader title="GFXA AI Tools" />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col overflow-hidden border-brand-blue/25 shadow-glow">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
            <h3 className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-blue/30 bg-brand-blue/10 text-brand-blue">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              Market Assistant
            </h3>
            <button
              type="button"
              onClick={() => { setHistory([GREETING]); flash("Chat cleared"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11.5px] text-ink-muted transition-all duration-200 hover:border-brand-blue/40 hover:text-white"
            >
              <Eraser className="h-3.5 w-3.5" strokeWidth={1.9} />
              Clear
            </button>
          </header>

          <div className="max-h-[520px] min-h-[320px] flex-1 space-y-4 overflow-y-auto p-5">
            {hydrated
              ? history.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                        m.role === "user"
                          ? "bg-brand-blue text-white"
                          : "border border-white/[0.08] bg-white/[0.03] text-ink-muted"
                      }`}
                    >
                      <Rich text={m.text} />
                    </div>
                  </div>
                ))
              : null}

            {thinking ? (
              <div className="flex justify-start">
                <div className="flex gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-pulseRing rounded-full bg-brand-blue"
                      style={{ animationDelay: `${i * 0.16}s` }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/[0.08] p-5">
            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1.5 transition-colors duration-200 focus-within:border-brand-blue/40"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI..."
                aria-label="Ask the market assistant"
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13.5px] text-ink placeholder:text-ink-muted/70 outline-none"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim() || thinking}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white transition-all duration-200 hover:bg-[#4A93FF] active:scale-95 disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              {AI_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInput(c)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-left text-[12px] text-ink-muted transition-all duration-200 hover:border-brand-blue/30 hover:bg-brand-blue/[0.08] hover:text-ink"
                >
                  {c}
                </button>
              ))}
            </div>

            <p className="mt-4 border-t border-white/[0.08] pt-3.5 text-[11px] leading-relaxed text-ink-muted/70">
              Responses are generated from this platform&apos;s own market data for education &amp; market
              intelligence. Not financial advice.
            </p>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHead title="AI Market Summary" icon={FileText} />
            <div className="p-5">
              {summary ? (
                <div className="text-[13px] leading-relaxed text-ink-muted">
                  <Rich text={summary} />
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  A written read of the whole session — FX, metals, and the one thing worth watching
                  next.
                </p>
              )}
              <button
                type="button"
                onClick={() => { setSummary(SUMMARY); flash("Summary generated"); }}
                className="btn-primary mt-5 w-full !py-2.5 text-[12.5px]"
              >
                {summary ? "Regenerate Summary" : "Generate Summary"}
              </button>
            </div>
          </Card>

          <Card>
            <CardHead title="AI Trade Idea Generator" icon={Lightbulb} />
            <div className="p-5">
              <Select label="Pair" value={ideaPair} onChange={(e) => setIdeaPair(e.target.value)}>
                {PAIRS.map((p) => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
              </Select>

              {idea ? (
                <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-[13px] leading-relaxed text-ink-muted">
                  <Rich text={idea} />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => { setIdea(tradeIdea(ideaPair)); flash("Idea generated"); }}
                className="btn-primary mt-4 w-full !py-2.5 text-[12.5px]"
              >
                Generate Idea
              </button>

              <p className="mt-4 text-[11px] leading-relaxed text-ink-muted/70">
                Worked examples for study. Never a signal or a recommendation.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}
