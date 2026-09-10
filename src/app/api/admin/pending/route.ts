import { NextResponse } from "next/server";
import { guard } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** The review queue. Service role, so RLS does not hide rows from the admin. */
export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Supabase is not configured." }, { status: 503 });

  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const valid = ["pending", "approved", "rejected", "banned"].includes(status);

  let q = db.from("profiles").select("*").order("created_at", { ascending: false }).limit(500);
  if (valid && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json(
    { ok: true, status, profiles: data ?? [], count: (data ?? []).length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
