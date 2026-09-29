import { NextResponse } from "next/server";
import { academyContext, notInstalled } from "@/lib/academyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The five books, their lessons, and this member's progress through them. */
export async function GET() {
  const ctx = await academyContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  const [books, lessons, progress, pages] = await Promise.all([
    db.from("academy_books").select("*").order("book_number"),
    db.from("academy_lessons").select("*").order("lesson_number"),
    db.from("academy_progress").select("lesson_id, is_complete, progress_percent, last_page").eq("user_id", user.id),
    // Page counts come from the table, so a lesson with nothing uploaded shows
    // as "not ready" instead of opening an empty viewer.
    db.from("academy_pages").select("lesson_id"),
  ]);

  if (notInstalled(books.error?.message) || notInstalled(lessons.error?.message)) {
    return NextResponse.json(
      { ok: false, installed: false, message: "Academy tables not installed — run supabase/20250929_academy_books.sql." },
      { status: 503 }
    );
  }
  if (books.error) return NextResponse.json({ ok: false, message: books.error.message }, { status: 502 });

  const pageCount = new Map<string, number>();
  for (const p of pages.data ?? []) pageCount.set(p.lesson_id, (pageCount.get(p.lesson_id) ?? 0) + 1);
  const mine = new Map((progress.data ?? []).map((p) => [p.lesson_id, p]));

  const lessonRows = (lessons.data ?? []).map((l) => ({
    ...l,
    pages: pageCount.get(l.id) ?? 0,
    complete: !!mine.get(l.id)?.is_complete,
    percent: mine.get(l.id)?.progress_percent ?? 0,
    lastPage: mine.get(l.id)?.last_page ?? 1,
  }));

  const done = lessonRows.filter((l) => l.complete).length;

  return NextResponse.json(
    {
      ok: true,
      installed: true,
      books: books.data ?? [],
      lessons: lessonRows,
      summary: {
        total: lessonRows.length,
        done,
        percent: lessonRows.length ? Math.round((done / lessonRows.length) * 100) : 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
