import { NextResponse } from "next/server";
import { academyContext } from "@/lib/academyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Records the page a member reached, and completion when they finish. */
export async function POST(request: Request) {
  const ctx = await academyContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  let body: { lesson_id?: string; page?: number; complete?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const lessonId = (body.lesson_id ?? "").trim();
  if (!lessonId) return NextResponse.json({ ok: false, message: "Need a lesson id." }, { status: 400 });

  const { data: lesson } = await db.from("academy_lessons").select("id").eq("id", lessonId).maybeSingle();
  if (!lesson) return NextResponse.json({ ok: false, message: "No such lesson." }, { status: 404 });

  const { count } = await db
    .from("academy_pages")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  const total = count ?? 0;

  const { data: existing } = await db
    .from("academy_progress").select("viewed_pages, is_complete")
    .eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle();

  const page = Number.isInteger(body.page) && (body.page as number) > 0 ? (body.page as number) : null;
  const viewed = new Set<number>(existing?.viewed_pages ?? []);
  if (page) viewed.add(page);

  const complete = body.complete === true || existing?.is_complete === true;
  const percent = complete ? 100 : total ? Math.min(99, Math.round((viewed.size / total) * 100)) : 0;

  const { error } = await db.from("academy_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      is_complete: complete,
      progress_percent: percent,
      viewed_pages: Array.from(viewed).sort((a, b) => a - b),
      last_page: page ?? 1,
      completed_at: complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  // The headline figure the panel shows, recomputed server-side.
  const [{ count: totalLessons }, { count: doneLessons }] = await Promise.all([
    db.from("academy_lessons").select("id", { count: "exact", head: true }),
    db.from("academy_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_complete", true),
  ]);

  return NextResponse.json(
    {
      ok: true,
      lesson: { id: lessonId, complete, percent },
      summary: {
        total: totalLessons ?? 0,
        done: doneLessons ?? 0,
        percent: totalLessons ? Math.round(((doneLessons ?? 0) / totalLessons) * 100) : 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
