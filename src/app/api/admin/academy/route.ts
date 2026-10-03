import { NextResponse } from "next/server";
import { adminApi, tableMissing } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "academy-books";

/**
 * Academy health.
 *
 * Every number here is counted at request time rather than recalled from the
 * last import run. That is the point: the bug this tab exists to catch —
 * Book 01's twelfth lesson having no pages, fixed in 4ee4122 — was invisible
 * precisely because the importer reported success and nothing re-checked the
 * rows afterwards.
 */
export async function GET() {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;

  const [books, lessons, pages, views, progress] = await Promise.all([
    db.from("academy_books").select("id,book_number,title,total_pages,total_lessons").order("book_number"),
    db.from("academy_lessons").select("id,book_id,lesson_number,book_lesson,title,track").order("lesson_number"),
    db.from("academy_pages").select("lesson_id,page_number,object_path"),
    db.from("academy_views").select("lesson_id").limit(20000),
    db.from("academy_progress").select("user_id,lesson_id,is_complete,progress_percent"),
  ]);

  if (tableMissing(books.error?.message)) {
    return NextResponse.json(
      { ok: true, installed: false, message: "Academy tables not installed — run supabase/20250929_academy_books.sql." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (books.error) return NextResponse.json({ ok: false, message: books.error.message }, { status: 502 });

  const bookRows = books.data ?? [];
  const lessonRows = lessons.data ?? [];
  const pageRows = (pages.data ?? []) as { lesson_id: string; page_number: number; object_path: string | null }[];

  const perLesson = new Map<string, number>();
  for (const p of pageRows) perLesson.set(p.lesson_id, (perLesson.get(p.lesson_id) ?? 0) + 1);

  const viewCount = new Map<string, number>();
  for (const v of (views.data ?? []) as { lesson_id: string | null }[]) {
    if (v.lesson_id) viewCount.set(v.lesson_id, (viewCount.get(v.lesson_id) ?? 0) + 1);
  }

  /* --------------------------------------------------- per book and lesson */

  const booksOut = bookRows.map((b) => {
    const own = lessonRows.filter((l) => l.book_id === b.id).sort((a, b2) => a.book_lesson - b2.book_lesson);
    const split = own.map((l) => perLesson.get(l.id) ?? 0);
    return {
      bookNumber: b.book_number,
      title: b.title,
      lessons: own.length,
      pages: split.reduce((a, n) => a + n, 0),
      // What the books table claims, kept next to what the pages table actually
      // holds — a mismatch means the importer wrote one and not the other.
      claimedPages: b.total_pages,
      split,
      empty: own.filter((l, i) => split[i] === 0).map((l) => ({ bookLesson: l.book_lesson, title: l.title })),
    };
  });

  const totalPages = booksOut.reduce((a, b) => a + b.pages, 0);
  const emptyLessons = booksOut.reduce((a, b) => a + b.empty.length, 0);

  /* --------------------------------------------- rows against the bucket */

  const stored = new Set<string>();
  let storageError: string | null = null;
  for (const b of bookRows) {
    const folder = `book-${String(b.book_number).padStart(2, "0")}`;
    const { data, error } = await db.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (error) { storageError = error.message; break; }
    for (const o of data ?? []) stored.add(`${folder}/${o.name}`);
  }

  const paths = pageRows.map((p) => p.object_path).filter((p): p is string => !!p);
  const pathSet = new Set(paths);
  const integrity = storageError
    ? null
    : {
        rows: pageRows.length,
        objects: stored.size,
        // A row pointing at a file that is not there is a page that will 404
        // for a member; an object with no row is dead weight in the bucket.
        missingFile: paths.filter((p) => !stored.has(p)).length,
        orphanObjects: Array.from(stored).filter((o) => !pathSet.has(o)).length,
        duplicatePaths: paths.length - pathSet.size,
        rowsWithoutPath: pageRows.length - paths.length,
      };

  /* ------------------------------------------------------- what gets read */

  const lessonTitle = new Map(lessonRows.map((l) => [l.id, l]));
  const mostViewed = Array.from(viewCount.entries())
    .map(([id, count]) => {
      const l = lessonTitle.get(id);
      const book = bookRows.find((b) => b.id === l?.book_id);
      return {
        lesson: l?.title ?? "(deleted lesson)",
        book: book ? `Book ${String(book.book_number).padStart(2, "0")}` : "—",
        track: l?.track ?? null,
        views: count,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const progressRows = (progress.data ?? []) as { user_id: string; is_complete: boolean }[];
  const learners = new Set(progressRows.map((p) => p.user_id));
  const completed = progressRows.filter((p) => p.is_complete).length;

  return NextResponse.json(
    {
      ok: true,
      installed: true,
      books: booksOut,
      totals: { pages: totalPages, lessons: lessonRows.length, emptyLessons, expectedPages: 444 },
      integrity,
      storageError,
      mostViewed,
      engagement: {
        learners: learners.size,
        lessonsCompleted: completed,
        totalLessons: lessonRows.length,
        // Per learner who has opened anything, not per registered member —
        // dividing by every account would read as a failure of the material
        // rather than of sign-ups.
        completionPercent: learners.size && lessonRows.length
          ? Math.round((completed / (learners.size * lessonRows.length)) * 1000) / 10
          : 0,
        // ViewContent is fired by the viewer once per lesson opened
        // (BookViewer.tsx); this is the same action counted in our own table.
        viewEvents: (views.data ?? []).length,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
