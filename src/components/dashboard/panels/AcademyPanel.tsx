"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Clock, GraduationCap, Play } from "lucide-react";
import { Card, CardHead, PanelHeader, Skeleton, Toast } from "@/components/ui/Primitives";
import { TRACKS, type Lesson, type Track } from "@/lib/content";
import { KEYS, usePersistentState } from "@/lib/storage";

const LEVEL_STYLE: Record<Track["level"], string> = {
  Foundation: "bg-brand-blue/[0.13] text-brand-blue",
  Intermediate: "bg-[#FFB020]/[0.13] text-[#FFB020]",
  Advanced: "bg-brand-green/[0.13] text-brand-green",
};

/** Seeds a realistic starting point: 80% / 30% / 10% per the curriculum design. */
const INITIAL_DONE: string[] = [
  ...TRACKS[0].lessons.slice(0, 10).map((l) => l.id),
  ...TRACKS[1].lessons.slice(0, 5).map((l) => l.id),
  ...TRACKS[2].lessons.slice(0, 1).map((l) => l.id),
];

export function AcademyPanel() {
  const { value: done, setValue: setDone, hydrated } = usePersistentState<string[]>(
    KEYS.academy,
    INITIAL_DONE
  );
  const [openTrack, setOpenTrack] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const totalLessons = TRACKS.reduce((n, t) => n + t.lessons.length, 0);
  const overall = Math.round((done.length / totalLessons) * 100);

  const track = useMemo(() => TRACKS.find((t) => t.id === openTrack) ?? null, [openTrack]);

  const pctFor = (t: Track) =>
    Math.round((t.lessons.filter((l) => done.includes(l.id)).length / t.lessons.length) * 100);

  const toggle = (id: string, title: string) => {
    const nowDone = !done.includes(id);
    setDone((prev) => (nowDone ? [...prev, id] : prev.filter((x) => x !== id)));
    setToast(nowDone ? `Completed: ${title}` : `Marked incomplete: ${title}`);
    setTimeout(() => setToast(null), 1800);
  };

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (track) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => { setOpenTrack(null); setLesson(null); }}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted transition-colors duration-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          All tracks
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[22px] font-bold tracking-tight text-white">{track.title}</h2>
          <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] ${LEVEL_STYLE[track.level]}`}>
            {track.level}
          </span>
          <span className="ml-auto num-mono text-[13px] font-semibold text-brand-blue">
            {pctFor(track)}% complete
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHead title={`${track.lessons.length} Lessons`} icon={GraduationCap} />
            <ul className="divide-y divide-white/[0.06]">
              {track.lessons.map((l, i) => {
                const complete = done.includes(l.id);
                const active = lesson?.id === l.id;
                return (
                  <li key={l.id}>
                    <div className={`flex items-center gap-3 px-4 py-3 transition-colors duration-200 ${active ? "bg-brand-blue/[0.07]" : "hover:bg-white/[0.02]"}`}>
                      <button
                        type="button"
                        onClick={() => toggle(l.id, l.title)}
                        aria-label={complete ? `Mark ${l.title} incomplete` : `Mark ${l.title} complete`}
                        aria-pressed={complete}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                          complete
                            ? "border-brand-green/50 bg-brand-green/20 text-brand-green"
                            : "border-white/[0.14] text-transparent hover:border-brand-blue/50"
                        }`}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setLesson(l)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="num-mono w-5 shrink-0 text-[11px] text-ink-muted/60">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-[13.5px] ${complete ? "text-ink-muted line-through" : "text-ink"}`}>
                          {l.title}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-muted/70">
                          <Clock className="h-3 w-3" strokeWidth={1.9} />
                          {l.minutes}m
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="h-fit">
            <CardHead title={lesson ? "Lesson" : "Select a lesson"} />
            <div className="p-5">
              {lesson ? (
                <>
                  <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[radial-gradient(70%_70%_at_50%_40%,rgba(42,127,255,0.14),transparent_70%)]">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-blue/40 bg-brand-blue/15 text-brand-blue shadow-glow">
                      <Play className="ml-0.5 h-5 w-5" fill="currentColor" strokeWidth={0} />
                    </span>
                    <span className="absolute bottom-3 left-4 text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                      Video placeholder
                    </span>
                  </div>

                  <h3 className="mt-5 text-[18px] font-bold tracking-tight text-white">{lesson.title}</h3>
                  <p className="mt-1 text-[11.5px] text-ink-muted">{lesson.minutes} minute lesson</p>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">{lesson.summary}</p>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggle(lesson.id, lesson.title)}
                      className="btn-primary !px-4 !py-2.5 text-[12.5px]"
                    >
                      {done.includes(lesson.id) ? "Mark incomplete" : "Mark complete"}
                      <Check className="h-4 w-4" strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setToast("Quiz coming soon"); setTimeout(() => setToast(null), 1800); }}
                      className="btn-ghost !px-4 !py-2.5 text-[12.5px]"
                    >
                      Take the quiz
                    </button>
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-[13px] text-ink-muted">
                  Pick a lesson from the list to open it.
                </p>
              )}
            </div>
          </Card>
        </div>

        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelHeader
        title="GFXA Academy"
        action={
          <span className="text-[12.5px] text-ink-muted">
            Your progress <span className="num-mono ml-1 font-bold text-brand-blue">{overall}%</span>
          </span>
        }
      />

      <Card className="p-5">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-ink-muted">
            <span className="num-mono font-semibold text-white">{done.length}</span> of{" "}
            <span className="num-mono">{totalLessons}</span> lessons complete
          </span>
          <span className="num-mono font-bold text-white">{overall}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-200"
            style={{ width: `${overall}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {TRACKS.map((t, i) => {
          const pct = pctFor(t);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenTrack(t.id)}
              className="group flex flex-col rounded-2xl glass p-7 text-left transition-all duration-200 hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-glow"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-blue/25 bg-brand-blue/10 text-brand-blue">
                  <GraduationCap className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] ${LEVEL_STYLE[t.level]}`}>
                  {t.level}
                </span>
              </div>

              <span className="num-mono mt-6 block text-[12px] font-semibold text-ink-muted/60">
                Track 0{i + 1}
              </span>
              <h3 className="mt-2 text-[19px] font-bold tracking-tight text-white">{t.title}</h3>
              <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-ink-muted">{t.blurb}</p>

              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-muted">
                    <span className="num-mono font-semibold text-ink">{t.lessons.length}</span> lessons
                  </span>
                  <span className="num-mono font-bold text-brand-blue">{pct}%</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <span
                    className="block h-full rounded-full bg-brand-blue transition-all duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Toast message={toast} />
    </div>
  );
}
