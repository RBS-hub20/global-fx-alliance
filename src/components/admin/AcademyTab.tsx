"use client";

import { CARD, Empty, Head, Pill, Stat, Table, Td, useJson } from "./bits";

interface Payload {
  installed: boolean;
  message?: string;
  books: {
    bookNumber: number; title: string; lessons: number; pages: number; claimedPages: number;
    split: number[]; empty: { bookLesson: number; title: string }[];
  }[];
  totals: { pages: number; lessons: number; emptyLessons: number; expectedPages: number };
  integrity: {
    rows: number; objects: number; missingFile: number; orphanObjects: number;
    duplicatePaths: number; rowsWithoutPath: number;
  } | null;
  storageError: string | null;
  mostViewed: { lesson: string; book: string; track: string | null; views: number }[];
  engagement: {
    learners: number; lessonsCompleted: number; totalLessons: number;
    completionPercent: number; viewEvents: number;
  };
}

export function AcademyTab() {
  const { data, error, loading } = useJson<Payload>("/api/admin/academy");

  if (loading && !data) return <div className={`${CARD} px-4 py-8 text-center font-mono text-[12px] text-[#737373]`}>Counting pages…</div>;
  if (error) return <div className={`${CARD} px-4 py-6 font-mono text-[12px] text-[#ef4444]`}>{error}</div>;
  if (!data) return null;
  if (!data.installed) return <div className={`${CARD} px-4 py-6 font-mono text-[12px] text-[#facc15]`}>{data.message}</div>;

  const { totals, integrity } = data;
  const pagesOk = totals.pages === totals.expectedPages;
  const clean = integrity && !integrity.missingFile && !integrity.orphanObjects && !integrity.duplicatePaths;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pages stored" value={totals.pages} sub={`expected ${totals.expectedPages}`} tone={pagesOk ? "good" : "bad"} />
        <Stat label="Lessons" value={totals.lessons} sub="across 5 books" />
        <Stat label="Lessons with no pages" value={totals.emptyLessons}
          sub={totals.emptyLessons ? "a member would see an empty viewer" : "none — nothing opens empty"}
          tone={totals.emptyLessons ? "bad" : "good"} />
        <Stat label="Lesson opens" value={data.engagement.viewEvents} sub="academy_views rows" />
      </div>

      {/* ------------------------------------------------------- per book */}
      <section className={CARD}>
        <Head right={<Pill tone={pagesOk && clean ? "good" : "bad"}>{pagesOk && clean ? "intact" : "check"}</Pill>}>
          Books · page split per lesson
        </Head>
        <div className="divide-y divide-[#1c1c1c]">
          {data.books.map((b) => (
            <div key={b.bookNumber} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-[11px] text-[#00ff88]">Book {String(b.bookNumber).padStart(2, "0")}</span>
                <span className="text-[13px] text-white">{b.title}</span>
                <span className="ml-auto font-mono text-[12px] tabular-nums text-[#a3a3a3]">
                  {b.pages} pages · {b.lessons} lessons
                </span>
                {b.claimedPages !== b.pages ? (
                  <Pill tone="warn">books.total_pages says {b.claimedPages}</Pill>
                ) : null}
                {b.empty.length ? <Pill tone="bad">{b.empty.length} empty</Pill> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {b.split.map((n, i) => (
                  <span key={i} title={`Lesson ${i + 1}: ${n} pages`}
                    className={`inline-flex h-6 min-w-[28px] items-center justify-center rounded border px-1 font-mono text-[11px] tabular-nums ${
                      n === 0 ? "border-[#ef4444] bg-[#ef4444]/15 text-[#ef4444]"
                        : "border-[#262626] bg-[#1c1c1c] text-[#a3a3a3]"}`}>
                    {n}
                  </span>
                ))}
              </div>
              {b.empty.length ? (
                <p className="mt-2 font-mono text-[11px] text-[#ef4444]">
                  No pages: {b.empty.map((e) => `L${e.bookLesson} ${e.title}`).join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Each tile is one lesson&apos;s page count, read from <code className="text-[#a3a3a3]">academy_pages</code> at
          request time. Book 01 lesson 12 read 0 here until 4ee4122 — the importer had reported success while the last
          lesson got nothing, so this is the check that would have caught it.
        </footer>
      </section>

      {/* ------------------------------------------------------ integrity */}
      <section className={CARD}>
        <Head>Rows against the bucket</Head>
        {data.storageError ? (
          <div className="px-4 py-4 font-mono text-[12px] text-[#ef4444]">Could not list storage: {data.storageError}</div>
        ) : integrity ? (
          <div className="grid gap-px bg-[#262626] sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["Page rows", integrity.rows, "good"],
              ["Objects in bucket", integrity.objects, integrity.objects === integrity.rows ? "good" : "warn"],
              ["Rows with no file", integrity.missingFile, integrity.missingFile ? "bad" : "good"],
              ["Orphan objects", integrity.orphanObjects, integrity.orphanObjects ? "warn" : "good"],
              ["Duplicate paths", integrity.duplicatePaths, integrity.duplicatePaths ? "bad" : "good"],
              ["Rows with no path", integrity.rowsWithoutPath, integrity.rowsWithoutPath ? "bad" : "good"],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="bg-[#141414] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737373]">{label}</p>
                <p className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                  tone === "good" ? "text-[#00ff88]" : tone === "warn" ? "text-[#facc15]" : "text-[#ef4444]"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------- engagement */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <Head>Most opened lessons</Head>
          {data.mostViewed.length === 0 ? (
            <Empty title="No lesson has been opened yet.">
              A row appears when an approved member opens a page — the viewer fires ViewContent once per lesson and the
              API logs the same open to <code>academy_views</code>.
            </Empty>
          ) : (
            <Table head={["Book", "Lesson", "Track", "Opens"]}>
              {data.mostViewed.map((m, i) => (
                <tr key={i} className="border-b border-[#1c1c1c] last:border-0">
                  <Td className="text-[#00ff88]">{m.book}</Td>
                  <Td className="max-w-[240px] truncate text-white">{m.lesson}</Td>
                  <Td className="text-[#737373]">{m.track ?? "—"}</Td>
                  <Td>{m.views}</Td>
                </tr>
              ))}
            </Table>
          )}
        </section>

        <section className={CARD}>
          <Head>Completion</Head>
          <div className="grid grid-cols-2 gap-px bg-[#262626]">
            <div className="bg-[#141414] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737373]">Learners</p>
              <p className="mt-1 font-mono text-2xl font-bold text-white">{data.engagement.learners}</p>
              <p className="text-[11px] text-[#737373]">opened at least one lesson</p>
            </div>
            <div className="bg-[#141414] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737373]">Lessons completed</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#00ff88]">{data.engagement.lessonsCompleted}</p>
              <p className="text-[11px] text-[#737373]">{data.engagement.completionPercent}% of what those learners could finish</p>
            </div>
          </div>
          <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
            The denominator is learners who have opened something × {data.engagement.totalLessons} lessons — not every
            registered account, which would report the sign-up rate as a completion rate.
          </footer>
        </section>
      </div>
    </div>
  );
}
