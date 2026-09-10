import { NextResponse } from "next/server";
import { guard } from "./adminAuth";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Shared approve/reject handler.
 *
 * In a lib rather than a route file: Next only permits its own known exports
 * from `route.ts`, so the two endpoints cannot import a helper from each other.
 */
export async function review(request: Request, status: "approved" | "rejected" | "banned") {
  const denied = guard(request);
  if (denied) return denied;

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });

  let body: { id?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "Need a profile id." }, { status: 400 });

  const { data, error } = await db
    .from("profiles")
    .update({ status, reviewed_at: new Date().toISOString(), note: (body.note ?? "").trim().slice(0, 300) || null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ ok: false, message: "No such profile." }, { status: 404 });

  return NextResponse.json({ ok: true, profile: data }, { headers: { "Cache-Control": "no-store" } });
}
