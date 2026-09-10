import { NextResponse } from "next/server";
import { botContext, rateLimited } from "@/lib/botGuard";
import { credentialAad, decrypt, encryptionReady } from "@/lib/encrypt";
import { executeTrade, vpsReady } from "@/lib/vpsClient";
import { getRealCandles } from "@/lib/marketProvider";
import { getPair } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** XAUUSD -> XAU/USD, so the price check uses the app's own provider chain. */
function toPairSymbol(symbol: string): string {
  const s = symbol.toUpperCase().replace("/", "");
  return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : symbol;
}

/**
 * Approve a pending trade and send it to the bridge.
 *
 * Everything is re-checked here rather than trusted from the click: ownership,
 * that it is still PENDING_APPROVAL, that it has not expired, and that price has
 * not run away from the level the member agreed to. The browser cannot write
 * this table at all, so this route is the only path from proposed to executed.
 */
export async function POST(request: Request) {
  const ctx = await botContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  if (rateLimited(`approve:${user.id}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, message: "Slow down." }, { status: 429 });
  }
  if (!encryptionReady() || !vpsReady()) {
    return NextResponse.json({ ok: false, message: "Execution is not configured on this deployment." }, { status: 503 });
  }

  let body: { log_id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }
  const logId = (body.log_id ?? "").trim();
  if (!logId) return NextResponse.json({ ok: false, message: "Need a log id." }, { status: 400 });

  const { data: log, error } = await db
    .from("execution_logs").select("*").eq("id", logId).eq("user_id", user.id).maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!log) return NextResponse.json({ ok: false, message: "No such trade." }, { status: 404 });
  if (log.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ ok: false, message: `Already ${String(log.status).toLowerCase()}.` }, { status: 409 });
  }
  if (new Date(log.expires_at).getTime() <= Date.now()) {
    await db.from("execution_logs").update({ status: "EXPIRED" }).eq("id", logId);
    return NextResponse.json({ ok: false, message: "That window closed — the price is stale." }, { status: 409 });
  }

  /*
   * Price drift. A member approves a level, not an instruction to fill at any
   * price; between the proposal and the tap the market moves, and a 60-second
   * window on gold is easily 30 pips. Checked against the same provider the
   * charts use so the number is one the member could have seen.
   */
  const pairSymbol = toPairSymbol(log.symbol);
  const feed = await getRealCandles(pairSymbol, "1M").catch(() => null);
  if (feed?.price) {
    const pipSize = getPair(pairSymbol).pipSize || 0.1;
    const driftPips = Math.abs(feed.price - Number(log.price)) / pipSize;
    if (driftPips > Number(log.price_tolerance_pips)) {
      await db.from("execution_logs")
        .update({ status: "EXPIRED", vps_response: { skipped: "price_drift", driftPips: Math.round(driftPips), seen: feed.price } })
        .eq("id", logId);
      return NextResponse.json(
        { ok: false, message: `Price moved ${Math.round(driftPips)} pips past the ${log.price_tolerance_pips}-pip tolerance. Not sent.` },
        { status: 409 }
      );
    }
  }

  const { data: account } = await db
    .from("vt_accounts")
    .select("id, account_number, server, master_password_encrypted, auto_execute_enabled")
    .eq("id", log.vt_account_id).eq("user_id", user.id).maybeSingle();

  if (!account?.master_password_encrypted) {
    return NextResponse.json(
      { ok: false, message: "That account has no master password stored, so it cannot place orders." },
      { status: 409 }
    );
  }

  await db.from("execution_logs").update({ status: "APPROVED", approved_at: new Date().toISOString() }).eq("id", logId);

  let password: string;
  try {
    password = decrypt(account.master_password_encrypted, credentialAad(user.id, account.account_number, account.server));
  } catch {
    // A failure here means the stored blob does not belong to this row — a
    // tampered or transplanted record. It is not a transient error.
    await db.from("execution_logs").update({ status: "FAILED", vps_response: { error: "credential_seal_invalid" } }).eq("id", logId);
    return NextResponse.json({ ok: false, message: "Stored credential failed verification. Reconnect the account." }, { status: 500 });
  }

  const sent = await executeTrade({
    accountNumber: account.account_number,
    password,
    server: account.server,
    symbol: log.symbol,
    action: log.action,
    lot: Number(log.lot),
    sl: log.sl === null ? null : Number(log.sl),
    tp: log.tp === null ? null : Number(log.tp),
    logId,
  });

  const patch = sent.ok
    ? { status: "EXECUTED", executed_at: new Date().toISOString(), vps_response: sent.data ?? {} }
    : { status: "FAILED", vps_response: { error: sent.error, status: sent.status } };

  const { data: updated } = await db.from("execution_logs").update(patch).eq("id", logId)
    .select("id, status, executed_at, vps_response").single();

  return NextResponse.json(
    { ok: sent.ok, message: sent.ok ? "Sent to the bridge." : sent.error, log: updated },
    { status: sent.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } }
  );
}
