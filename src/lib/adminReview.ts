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

  /*
   * `status` is the only column that must land. A profiles table built from an
   * earlier schema has no reviewed_at or note, and PostgREST rejects the whole
   * update naming one missing column at a time — which turned "approve" into
   * "Could not find the 'note' column" and left the member stuck as pending.
   * The audit fields are a nice-to-have; the decision is not, so they are
   * dropped one by one rather than blocking it.
   */
  const patch: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    note: (body.note ?? "").trim().slice(0, 300) || null,
  };

  const dropped: string[] = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await db.from("profiles").update(patch).eq("id", id).select().single();

    if (!res.error) {
      if (!res.data) return NextResponse.json({ ok: false, message: "No such profile." }, { status: 404 });
      return NextResponse.json(
        { ok: true, profile: res.data, droppedColumns: dropped.length ? dropped : undefined },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const missing = res.error.message.match(/Could not find the '([^']+)' column/)?.[1];
    if (!missing || missing === "status" || !(missing in patch)) {
      return NextResponse.json({ ok: false, message: res.error.message }, { status: 502 });
    }
    delete patch[missing];
    dropped.push(missing);
  }

  return NextResponse.json(
    { ok: false, message: "Too many missing columns — run supabase/profiles_add_audit_columns.sql." },
    { status: 502 }
  );

}
