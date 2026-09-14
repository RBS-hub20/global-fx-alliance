import { NextResponse } from "next/server";
import { botContext, rateLimited } from "@/lib/botGuard";
import { dubaiDate } from "@/lib/pnlCalendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A trade typed in by hand.
 *
 * Stored at 12:00 Dubai on the chosen day. A manual entry has a day but no real
 * time, so it is stamped mid-day where no timezone can tip it onto a neighbour,
 * and the worst-hour ranking skips manual rows so that stamp is never read as a
 * trading hour.
 */
export async function POST(request: Request) {
  const ctx = await botContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  if (rateLimited(`manual:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, message: "Slow down." }, { status: 429 });
  }

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const day = String(b.day ?? "");
  const symbol = String(b.symbol ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const pnl = Number(b.pnl);
  const lot = Number(b.lot);
  const action = b.action ? String(b.action).toUpperCase() : null;
  const notes = b.notes ? String(b.notes).trim().slice(0, 280) : null;
  const accountRaw = b.vt_account_id ? String(b.vt_account_id) : null;

  const fail = (message: string) => NextResponse.json({ ok: false, message }, { status: 400 });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00+04:00`))) return fail("Pick a valid day.");
  if (day > dubaiDate(new Date())) return fail("That day has not happened yet in Dubai.");
  if (symbol.length < 3 || symbol.length > 12) return fail("Enter a symbol, e.g. XAUUSD.");
  if (!Number.isFinite(pnl) || Math.abs(pnl) > 10_000_000) return fail("P&L must be a number.");
  if (!(lot > 0 && lot <= 100)) return fail("Lot must be above 0.");
  if (action && !["BUY", "SELL"].includes(action)) return fail("Action must be BUY or SELL.");

  let accountId: string | null = null;
  if (accountRaw) {
    if (!UUID.test(accountRaw)) return fail("Bad account id.");
    const { data } = await db.from("vt_accounts").select("id").eq("id", accountRaw).eq("user_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, message: "That account is not yours." }, { status: 403 });
    accountId = data.id;
  }

  const at = new Date(`${day}T12:00:00+04:00`).toISOString();

  const { data, error } = await db
    .from("execution_logs")
    .insert({
      user_id: user.id,
      vt_account_id: accountId,
      symbol, action, lot, notes,
      pnl: Math.round(pnl * 100) / 100,
      source: "manual",   // forced here — never taken from the body
      status: "MANUAL",
      executed_at: at,
      closed_at: at,
      expires_at: at,
    })
    .select("id, symbol, pnl, closed_at")
    .single();

  if (error) {
    const setup = /column .* does not exist|violates check constraint/i.test(error.message);
    return NextResponse.json(
      { ok: false, message: setup ? "PNL tables not installed — run supabase/20250517_pnl_calendar.sql." : error.message },
      { status: setup ? 503 : 502 }
    );
  }

  return NextResponse.json({ ok: true, trade: data }, { headers: { "Cache-Control": "no-store" } });
}
