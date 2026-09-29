import { NextResponse } from "next/server";
import { academyContext } from "@/lib/academyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRY_SECONDS = 60;

/**
 * One signed URL for one page, valid for a minute.
 *
 * The bucket is private and has no storage policies, so a browser cannot read
 * it directly; this route is the only way in, and it checks the session and the
 * membership first. Each hand-out is logged with the member and the page.
 */
export async function GET(request: Request) {
  const ctx = await academyContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  const params = new URL(request.url).searchParams;
  const lessonId = params.get("lesson") ?? "";
  const page = Number(params.get("page") ?? "1");

  if (!lessonId || !Number.isInteger(page) || page < 1) {
    return NextResponse.json({ ok: false, message: "Need a lesson and a page." }, { status: 400 });
  }

  const { data: row, error } = await db
    .from("academy_pages")
    .select("id, page_number, content_type, object_path, body")
    .eq("lesson_id", lessonId)
    .eq("page_number", page)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!row) return NextResponse.json({ ok: false, message: "That page is not uploaded yet." }, { status: 404 });

  // Text pages need no signature.
  if (row.content_type === "text") {
    await db.from("academy_views").insert({ user_id: user.id, lesson_id: lessonId, page_number: page });
    return NextResponse.json({ ok: true, type: "text", body: row.body ?? "" }, { headers: { "Cache-Control": "no-store" } });
  }

  if (!row.object_path) return NextResponse.json({ ok: false, message: "That page has no image." }, { status: 404 });

  const signed = await db.storage.from("academy-books").createSignedUrl(row.object_path, EXPIRY_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ ok: false, message: signed.error?.message ?? "Could not sign that page." }, { status: 502 });
  }

  await db.from("academy_views").insert({ user_id: user.id, lesson_id: lessonId, page_number: page });

  return NextResponse.json(
    { ok: true, type: "image", url: signed.data.signedUrl, expiresIn: EXPIRY_SECONDS },
    { headers: { "Cache-Control": "no-store" } }
  );
}
