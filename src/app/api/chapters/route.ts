import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tableMissing } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The chapter codes that exist. Checked here rather than trusted from the body,
 * so the table cannot collect memberships of chapters that do not exist.
 */
const CODES = new Set(["PH", "AE", "SG", "GB", "US", "JP", "MY", "ID", "CA", "IN", "TR"]);

/** Real membership: how many people are in each chapter, and which this member joined. */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  const { data, error } = await db.from("chapter_members").select("user_id,chapter_code").limit(20000);

  if (tableMissing(error?.message)) {
    // Not installed: the panel keeps its existing behaviour rather than showing
    // every chapter as empty.
    return NextResponse.json({ ok: true, installed: false, counts: {}, mine: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const row of data ?? []) {
    counts[row.chapter_code] = (counts[row.chapter_code] ?? 0) + 1;
    if (row.user_id === user.id) mine.push(row.chapter_code);
  }

  // Totals and the caller's own rows only — never a list of who is in what.
  return NextResponse.json({ ok: true, installed: true, counts, mine }, { headers: { "Cache-Control": "no-store" } });
}

/** Join or leave. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  let body: { code?: string; join?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!CODES.has(code)) return NextResponse.json({ ok: false, message: "No such chapter." }, { status: 404 });

  const result = body.join === false
    ? await db.from("chapter_members").delete().eq("user_id", user.id).eq("chapter_code", code)
    // Idempotent: joining twice is the same as joining once, which matters when
    // a double tap on a phone sends two requests.
    : await db.from("chapter_members").upsert({ user_id: user.id, chapter_code: code }, { onConflict: "user_id,chapter_code" });

  if (tableMissing(result.error?.message)) {
    return NextResponse.json(
      { ok: false, installed: false, message: "Chapters are not set up yet — run supabase/20251010_chapter_members.sql." },
      { status: 503 }
    );
  }
  if (result.error) return NextResponse.json({ ok: false, message: result.error.message }, { status: 502 });

  const { count } = await db.from("chapter_members").select("user_id", { count: "exact", head: true }).eq("chapter_code", code);

  return NextResponse.json({ ok: true, code, joined: body.join !== false, members: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
