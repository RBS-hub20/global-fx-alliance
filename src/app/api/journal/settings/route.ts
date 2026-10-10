import { NextResponse } from "next/server";
import { journalContext, needsMigration, notInstalled } from "@/lib/journalApi";
import { DEFAULT_SETTINGS } from "@/lib/journalPro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = "account_balance,risk_per_trade,daily_loss_limit,max_trades,max_loss_streak";

/** Bounded so a typo cannot create a rule that can never be breached. */
const clamp = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

const shape = (r: Record<string, unknown> | null) => ({
  accountBalance: r?.account_balance === null || r?.account_balance === undefined ? null : Number(r.account_balance),
  riskPerTrade: Number(r?.risk_per_trade ?? DEFAULT_SETTINGS.riskPerTrade),
  dailyLossLimit: Number(r?.daily_loss_limit ?? DEFAULT_SETTINGS.dailyLossLimit),
  maxTrades: Number(r?.max_trades ?? DEFAULT_SETTINGS.maxTrades),
  maxLossStreak: Number(r?.max_loss_streak ?? DEFAULT_SETTINGS.maxLossStreak),
});

export async function GET() {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.db
    .from("journal_settings").select(COLUMNS).eq("user_id", ctx.user.id).maybeSingle();

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  // No row yet is not an error — it is a member who has not set their rules,
  // and the defaults are what the compliance panel measures against meanwhile.
  return NextResponse.json(
    { ok: true, installed: true, settings: shape(data as Record<string, unknown> | null) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 }); }

  const balance = body.accountBalance === null || body.accountBalance === "" ? null
    : clamp(body.accountBalance, 0, 1e9, 0) || null;

  const { data, error } = await ctx.db.from("journal_settings").upsert({
    user_id: ctx.user.id,
    account_balance: balance,
    risk_per_trade: clamp(body.riskPerTrade, 0.01, 100, DEFAULT_SETTINGS.riskPerTrade),
    daily_loss_limit: clamp(body.dailyLossLimit, 0.1, 100, DEFAULT_SETTINGS.dailyLossLimit),
    max_trades: Math.round(clamp(body.maxTrades, 1, 100, DEFAULT_SETTINGS.maxTrades)),
    max_loss_streak: Math.round(clamp(body.maxLossStreak, 1, 50, DEFAULT_SETTINGS.maxLossStreak)),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select(COLUMNS).single();

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, settings: shape(data as unknown as Record<string, unknown>) });
}
