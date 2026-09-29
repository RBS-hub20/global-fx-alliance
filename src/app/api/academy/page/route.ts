import { NextResponse } from "next/server";
import { academyContext } from "@/lib/academyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRY_SECONDS = 300;

/**
 * One signed URL for one page.
 *
 * Addressed by lesson and page number, never by a raw storage path: the client
 * asking for "book-01/page-001.webp" would mean any caller could walk the whole
 * bucket, which is the thing the private bucket exists to prevent. The path
 * lives in academy_pages, which no browser can read.
 *
 * Every hand-out needs a session and an approved membership, and is logged.
 */
export async function GET(request: Request) {
  const ctx = await academyContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  const params = new URL(request.url).searchParams;
  const lessonId = (params.get("lesson") ?? "").trim();
  const page = Number(params.get("page") ?? "1");

  if (!lessonId || !Number.isInteger(page) || page < 1) {
    return NextResponse.json({ ok: false, message: "Need a lesson and a page." }, { status: 400 });
  }

  const { data: row, error } = await db
    .from("academy_pages")
    .select("page_number, content_type, object_path, body")
    .eq("lesson_id", lessonId)
    .eq("page_number", page)
    .maybeSingle();

  if (error) {
    console.error("[academy/page] lookup failed", { lessonId, page, message: error.message });
    return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  }
  if (!row) {
    return NextResponse.json(
      { ok: false, message: "That page has not been uploaded yet.", lessonId, page, hint: "scripts/import-academy-pages.mjs" },
      { status: 404 }
    );
  }

  if (row.content_type === "text") {
    await db.from("academy_views").insert({ user_id: user.id, lesson_id: lessonId, page_number: page });
    return NextResponse.json({ ok: true, type: "text", body: row.body ?? "" }, { headers: { "Cache-Control": "no-store" } });
  }

  const path = (row.object_path ?? "").trim().replace(/^\/+/, "");
  if (!path) {
    return NextResponse.json({ ok: false, message: "That page has no image on file.", lessonId, page }, { status: 404 });
  }

  /*
   * Check the object is really there before signing. createSignedUrl happily
   * signs a key that does not exist, so the failure would otherwise surface as
   * a broken image with no explanation — which is what "Could not open that
   * page" was hiding.
   */
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const file = slash === -1 ? path : path.slice(slash + 1);
  const listed = await db.storage.from("academy-books").list(folder, { search: file, limit: 1 });
  if (listed.error || !listed.data?.some((o) => o.name === file)) {
    console.error("[academy/page] object missing", { lessonId, page, path, message: listed.error?.message });
    return NextResponse.json(
      {
        ok: false,
        message: "That page is registered but its file is missing from storage.",
        path, lessonId, page,
        hint: "Re-run scripts/import-academy-pages.mjs for this book.",
      },
      { status: 404 }
    );
  }

  const signed = await db.storage.from("academy-books").createSignedUrl(path, EXPIRY_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    console.error("[academy/page] sign failed", { path, message: signed.error?.message });
    return NextResponse.json({ ok: false, message: signed.error?.message ?? "Could not sign that page.", path }, { status: 502 });
  }

  await db.from("academy_views").insert({ user_id: user.id, lesson_id: lessonId, page_number: page });

  return NextResponse.json(
    { ok: true, type: "image", url: signed.data.signedUrl, expiresIn: EXPIRY_SECONDS },
    { headers: { "Cache-Control": "no-store" } }
  );
}
