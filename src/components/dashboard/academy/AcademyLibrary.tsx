"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, GraduationCap, Loader2, Lock } from "lucide-react";
import { Card, CardHead, PanelHeader } from "@/components/ui/Primitives";
import { BookViewer } from "./BookViewer";

/** The database-backed Academy: five books, forty lessons, progress per member. */

interface Book { id: string; book_number: number; title: string; slug: string; description: string | null; emoji: string | null }
interface Lesson {
  id: string; book_id: string; lesson_number: number; book_lesson: number;
  track: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED"; track_number: number;
  title: string; topic: string | null; pages: number; complete: boolean; percent: number; lastPage: number;
}
interface Summary { total: number; done: number; percent: number }

const TRACK_META = [
  { n: 1, key: "FOUNDATION" as const, label: "Forex Fundamentals", pill: "bg-[#00ff88]/[0.13] text-[#00ff88]" },
  { n: 2, key: "INTERMEDIATE" as const, label: "Technical Mastery", pill: "bg-[#facc15]/[0.13] text-[#facc15]" },
  { n: 3, key: "ADVANCED" as const, label: "Risk & Psychology", pill: "bg-[#00ff88]/[0.13] text-[#00ff88]" },
];

export function AcademyLibrary({
  books, lessons, summary, onSummary,
}: {
  books: Book[]; lessons: Lesson[]; summary: Summary; onSummary: (s: Summary) => void;
}) {
  const [openTrack, setOpenTrack] = useState<typeof TRACK_META[number] | null>(null);
  const [reading, setReading] = useState<Lesson | null>(null);
  const [rows, setRows] = useState(lessons);

  useEffect(() => setRows(lessons), [lessons]);

  const bookOf = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  const forTrack = useCallback((key: string) => rows.filter((l) => l.track === key), [rows]);

  const onProgress = useCallback((s: Summary) => {
    onSummary(s);
    setRows((prev) => prev.map((l) => (reading && l.id === reading.id ? { ...l, complete: s.done > summary.done ? true : l.complete } : l)));
  }, [onSummary, reading, summary.done]);

  /* ------------------------------------------------------------- reading */

  if (reading) {
    const book = bookOf.get(reading.book_id);
    return (
      <BookViewer
        lessonId={reading.id}
        title={reading.title}
        bookTitle={`Book ${String(book?.book_number ?? 0).padStart(2, "0")} — ${book?.title ?? ""}`}
        pages={reading.pages}
        startPage={reading.lastPage}
        onClose={() => setReading(null)}
        onProgress={onProgress}
      />
    );
  }

  /* -------------------------------------------------------------- drawer */

  if (openTrack) {
    const list = forTrack(openTrack.key);
    const byBook = new Map<string, Lesson[]>();
    for (const l of list) byBook.set(l.book_id, [...(byBook.get(l.book_id) ?? []), l]);

    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setOpenTrack(null)}
          className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors hover:text-[#00ff88]">
          <ArrowLeft className="h-3.5 w-3.5" /> All tracks
        </button>

        <PanelHeader title={`Track 0${openTrack.n} — ${openTrack.label}`} />

        {Array.from(byBook.entries()).map(([bookId, items]) => {
          const b = bookOf.get(bookId);
          return (
            <Card key={bookId}>
              <CardHead title={`Book ${String(b?.book_number ?? 0).padStart(2, "0")} — ${b?.title ?? ""} ${b?.emoji ?? ""}`} />
              <ul className="divide-y divide-[#262626]">
                {items.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={l.pages === 0}
                      onClick={() => setReading(l)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        l.complete ? "border-[#00ff88] bg-[#00ff88]/15 text-[#00ff88]" : "border-[#262626] text-[#525252]"
                      }`}>
                        {l.complete ? <Check className="h-3 w-3" strokeWidth={3} /> : l.book_lesson}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[#e5e5e5]">{l.title}</span>
                        <span className="block font-mono text-[10.5px] text-[#525252]">
                          {l.topic ?? ""}{l.pages ? ` · ${l.pages} page${l.pages === 1 ? "" : "s"}` : ""}
                        </span>
                      </span>
                      {l.pages === 0 ? (
                        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#525252]">
                          <Lock className="h-3 w-3" /> not uploaded
                        </span>
                      ) : (
                        <BookOpen className="h-4 w-4 shrink-0 text-[#a3a3a3]" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    );
  }

  /* --------------------------------------------------------------- tracks */

  return (
    <div className="space-y-5">
      <PanelHeader title="Academy" />

      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] text-[#a3a3a3]">Your progress</p>
          <p className="num-mono text-[20px] font-bold text-[#00ff88]">{summary.percent}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#262626]">
          <div className="h-full rounded-full bg-[#00ff88] transition-all duration-500" style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="mt-2 font-mono text-[11px] text-[#525252]">
          {summary.done} of {summary.total} lessons complete · 5 books
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {TRACK_META.map((t) => {
          const list = forTrack(t.key);
          const done = list.filter((l) => l.complete).length;
          const pct = list.length ? Math.round((done / list.length) * 100) : 0;
          return (
            <button key={t.key} type="button" onClick={() => setOpenTrack(t)}
              className="rounded-3xl border border-[#262626] bg-[#141414] p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-[#00ff88]/40">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-[#00ff88]" strokeWidth={1.9} />
                <span className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] ${t.pill}`}>
                  {t.key}
                </span>
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#525252]">Track 0{t.n}</p>
              <h3 className="text-[15px] font-bold text-[#e5e5e5]">{t.label}</h3>
              <p className="mt-1 font-mono text-[11px] text-[#a3a3a3]">{list.length} lessons</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#262626]">
                <div className="h-full rounded-full bg-[#00ff88] transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 num-mono text-[11px] text-[#00ff88]">{pct}%</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Loading shell, so the panel does not flash between fixture and library. */
export function AcademyLoading() {
  return (
    <div className="flex h-40 items-center justify-center text-[#a3a3a3]">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
