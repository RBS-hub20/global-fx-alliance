import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { safeEqual } from "@/lib/encrypt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sweeps expired proposals. Runs on the Vercel cron in vercel.json.
 *
 * The client also hides an expired card once its countdown reaches zero, but a
 * row that stays PENDING_APPROVAL in the database is approvable by anyone who
 * calls the API directly — the countdown is a display, this is the enforcement.
 * /api/bot/approve re-checks expiry too, so a late cron cannot let a stale trade
 * through; this only keeps the table honest.
 *
 * Scheduled daily in vercel.json, not every minute: Vercel's Hobby plan rejects
 * sub-daily cron expressions and the deployment fails to build. On Pro this can
 * be changed to "* * * * *". Either way /api/bot/status sweeps the caller's own
 * rows on read, so the panel is correct without waiting for this.
 *
 * Guarded by CRON_SECRET. Vercel sends it as `Authorization: Bearer …`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "CRON_SECRET is not set." }, { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  const { data, error } = await db
    .from("execution_logs")
    .update({ status: "EXPIRED" })
    .eq("status", "PENDING_APPROVAL")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, expired: data?.length ?? 0 });
}
