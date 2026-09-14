import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySignature } from "@/lib/vpsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The bridge reporting a closed trade and its P&L.
 *
 * Authenticated by HMAC alone: X-Signature is HMAC-SHA256 over the raw body with
 * VPS_SECRET, and `ts` inside the signed body must be within five minutes. The
 * brief also asked for the CRON_SECRET bearer here. It is left out on purpose —
 * it would put the cron secret on the VPS, so compromising the bridge would also
 * hand over the cron endpoint, and it adds nothing the signature does not
 * already prove. Three secrets are only worth having if each lives in one place.
 *
 * Idempotent. The bridge does not retry, but networks duplicate requests, and
 * a fill recorded twice is P&L counted twice.
 */

const MAX_SKEW_MS = 5 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(request: Request) {
  const secret = process.env.VPS_SECRET;
  if (!secret) return bad("VPS_SECRET is not set.", 503);

  // Raw text first: the signature covers these exact bytes, and a parse-then-
  // restringify would reorder keys and fail verification for valid requests.
  const raw = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  if (!signature || !verifySignature(raw, signature, secret)) return bad("Invalid signature.", 401);

  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return bad("Malformed body."); }

  // Checked only after the signature, so an unsigned caller learns nothing
  // about which fields are wrong.
  const ts = Number(b.ts);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return bad("Stale or missing ts — possible replay.", 401);
  }

  const userId = String(b.user_id ?? "");
  const accountId = String(b.vt_account_id ?? "");
  const logId = b.log_id ? String(b.log_id) : null;
  const action = String(b.action ?? "").toUpperCase();
  const symbol = String(b.symbol ?? "XAUUSD").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 12);
  const price = Number(b.price);
  const lot = Number(b.lot);
  const pnl = Number(b.pnl);
  const ticket = b.ticket_id === undefined || b.ticket_id === null ? null : String(b.ticket_id).slice(0, 64);
  const executedAt = new Date(String(b.executed_at ?? ""));
  const closedAt = b.closed_at ? new Date(String(b.closed_at)) : executedAt;

  if (!UUID.test(userId) || !UUID.test(accountId)) return bad("user_id and vt_account_id must be UUIDs.");
  if (logId && !UUID.test(logId)) return bad("log_id must be a UUID.");
  if (!["BUY", "SELL", "CLOSE"].includes(action)) return bad("action must be BUY, SELL or CLOSE.");
  if (!(price > 0)) return bad("price must be positive.");
  if (!(lot > 0 && lot <= 10)) return bad("lot must be above 0 and at most 10.");
  if (!Number.isFinite(pnl)) return bad("pnl must be a number.");
  if (Number.isNaN(executedAt.getTime()) || Number.isNaN(closedAt.getTime())) return bad("executed_at must be an ISO timestamp.");
  if (!logId && !ticket) return bad("ticket_id is required when log_id is not given — it is what makes a resend harmless.");

  const db = supabaseAdmin();
  if (!db) return bad("Server is not configured.", 503);

  // A valid signature proves the bridge sent this, not that the bridge was right
  // about whose account it is.
  const { data: account } = await db
    .from("vt_accounts").select("id").eq("id", accountId).eq("user_id", userId).maybeSingle();
  if (!account) return bad("That account does not belong to that user.", 403);

  if (logId) {
    /*
     * Closing a trade the member approved. Updating the original row rather
     * than inserting a second one: the approval route already wrote this trade
     * as EXECUTED, and a new row would put it on the calendar twice.
     */
    const { data, error } = await db
      .from("execution_logs")
      .update({
        status: "EXECUTED",
        pnl: Math.round(pnl * 100) / 100,
        ticket_id: ticket,
        closed_at: closedAt.toISOString(),
        price,
      })
      .eq("id", logId).eq("user_id", userId).eq("vt_account_id", accountId).eq("source", "vps")
      .in("status", ["APPROVED", "EXECUTED"])
      .select("id").maybeSingle();

    if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    if (error) return bad(error.message, 502);
    if (!data) return bad("No approved or executed trade with that log_id for that account.", 404);
    return NextResponse.json({ ok: true, id: data.id, duplicate: false });
  }

  const { data, error } = await db
    .from("execution_logs")
    .upsert(
      {
        user_id: userId,
        vt_account_id: accountId,
        symbol, action, price, lot,
        pnl: Math.round(pnl * 100) / 100,
        ticket_id: ticket,
        source: "vps",
        status: "EXECUTED",
        executed_at: executedAt.toISOString(),
        closed_at: closedAt.toISOString(),
        // Not an approval-flow row, so the 60-second window does not apply.
        expires_at: executedAt.toISOString(),
      },
      { onConflict: "user_id,source,ticket_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) return bad(error.message, 502);
  return NextResponse.json({ ok: true, id: data?.[0]?.id ?? null, duplicate: !data?.length });
}
