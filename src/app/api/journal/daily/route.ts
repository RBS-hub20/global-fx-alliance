import { NextResponse } from "next/server";
import { journalContext, needsMigration, notInstalled } from "@/lib/journalApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS =
  "day,bias,support,resistance,entry_zone,pre_market_plan," +
  "what_went_well,what_went_wrong,what_to_improve,tomorrow_plan,updated_at";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max = 4000) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The plan and the review for one day, or the last 60 days of them. */
export async function GET(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  const day = new URL(request.url).searchParams.get("day");
  let q = ctx.db.from("journal_daily").select(COLUMNS).eq("user_id", ctx.user.id);
  q = DAY.test(day ?? "") ? q.eq("day", day) : q.order("day", { ascending: false }).limit(60);

  const { data, error } = await q;
  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json(
    { ok: true, installed: true, days: data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PUT(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 }); }

  const day = String(body.day ?? "");
  if (!DAY.test(day)) return NextResponse.json({ ok: false, message: "Need a day as YYYY-MM-DD." }, { status: 400 });

  const { data, error } = await ctx.db.from("journal_daily").upsert({
    user_id: ctx.user.id,
    day,
    bias: ["bullish", "bearish", "neutral"].includes(String(body.bias)) ? String(body.bias) : null,
    support: num(body.support),
    resistance: num(body.resistance),
    entry_zone: text(body.entryZone, 120),
    pre_market_plan: text(body.preMarketPlan),
    what_went_well: text(body.whatWentWell),
    what_went_wrong: text(body.whatWentWrong),
    what_to_improve: text(body.whatToImprove),
    tomorrow_plan: text(body.tomorrowPlan),
    updated_at: new Date().toISOString(),
    // One review per day: writing it twice updates it rather than stacking.
  }, { onConflict: "user_id,day" }).select(COLUMNS).single();

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, day: data });
}
