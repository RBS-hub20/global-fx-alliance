import { NextResponse } from "next/server";
import { botContext } from "@/lib/botGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Skip a pending trade. Terminal — a rejected proposal is not re-approvable. */
export async function POST(request: Request) {
  const ctx = await botContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  let body: { log_id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }
  const logId = (body.log_id ?? "").trim();
  if (!logId) return NextResponse.json({ ok: false, message: "Need a log id." }, { status: 400 });

  // Ownership and state are both in the filter, so a second click on a trade
  // that already went through cannot rewrite its status.
  const { data, error } = await db
    .from("execution_logs")
    .update({ status: "REJECTED", approved_at: new Date().toISOString() })
    .eq("id", logId).eq("user_id", user.id).eq("status", "PENDING_APPROVAL")
    .select("id, status").maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ ok: false, message: "Nothing pending with that id." }, { status: 409 });

  return NextResponse.json({ ok: true, log: data }, { headers: { "Cache-Control": "no-store" } });
}
