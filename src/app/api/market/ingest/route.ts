import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/vpsClient";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tableMissing } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How stale a signed body may be. Long enough for a slow link, short enough
 *  that a captured request is useless by the time anyone replays it. */
const MAX_SKEW_MS = 120_000;

const SYMBOLS = new Set(["XAU/USD", "XAG/USD", "EUR/USD", "GBP/USD", "USD/JPY", "DXY"]);

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Where the VPS relay pushes ticks.
 *
 * Authenticated by HMAC over the exact body bytes with VPS_SECRET — the same
 * scheme vpsClient.ts uses in the other direction, so the bridge already has
 * the key and the code to sign with it. No session: the caller is a daemon, not
 * a person.
 *
 * The signature is over the raw text, and that same text is parsed. Verifying a
 * re-serialisation would let key order drift and break on a Python dict that
 * happens to iterate differently.
 */
export async function POST(request: Request) {
  const secret = process.env.VPS_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "Relay is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("x-signature") ?? "";
  const raw = await request.text();

  if (raw.length > 8000) return NextResponse.json({ ok: false, message: "Body too large." }, { status: 413 });
  if (!signature || !verifySignature(raw, signature, secret)) {
    return NextResponse.json({ ok: false, message: "Bad signature." }, { status: 401 });
  }

  let body: { symbol?: string; price?: unknown; ts?: number; [k: string]: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed body." }, { status: 400 });
  }

  // The timestamp is inside the signed body, so it cannot be adjusted without
  // breaking the signature — which is what makes this a replay check.
  const ts = num(body.ts);
  if (ts === null || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return NextResponse.json({ ok: false, message: "Stale or missing timestamp." }, { status: 401 });
  }

  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  if (!SYMBOLS.has(symbol)) return NextResponse.json({ ok: false, message: "Unknown symbol." }, { status: 400 });

  const price = num(body.price);
  if (price === null || price <= 0) {
    return NextResponse.json({ ok: false, message: "A tick needs a price." }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  const now = new Date().toISOString();
  const { error } = await db.from("market_ticks").upsert(
    {
      symbol,
      price,
      change_percent: num(body.change_percent),
      rsi: num(body.rsi),
      bb_width: num(body.bb_width),
      ema50_dist: num(body.ema50_dist),
      adx: num(body.adx),
      data: (body.data ?? {}) as Record<string, unknown>,
      source: String(body.source ?? "twelvedata-ws").slice(0, 40),
      observed_at: ts ? new Date(ts).toISOString() : now,
      updated_at: now,
    },
    { onConflict: "symbol" }
  );

  if (tableMissing(error?.message)) {
    return NextResponse.json(
      { ok: false, message: "market_ticks does not exist — run supabase/20251011_market_ticks.sql." },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json({ ok: true, symbol }, { headers: { "Cache-Control": "no-store" } });
}
