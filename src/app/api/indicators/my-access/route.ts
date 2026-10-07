import { NextResponse } from "next/server";
import { indicatorContext, notInstalled } from "@/lib/indicatorGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** This member's own invites, joined to the indicator they belong to. */
export async function GET() {
  const ctx = await indicatorContext();
  if (ctx instanceof NextResponse) return ctx;
  const { db, user, eligible, reason } = ctx;

  const { data, error } = await db
    .from("indicator_access")
    .select("id,status,tradingview_username,approved_at,expires_at,created_at,indicator_definitions(slug,name,symbol,timeframe)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (notInstalled(error?.message)) {
    return NextResponse.json({ ok: true, installed: false, access: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json(
    { ok: true, installed: true, access: data ?? [], eligibility: { eligible, reason } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
