import { NextResponse } from "next/server";
import { indicatorContext, notInstalled } from "@/lib/indicatorGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The catalogue, plus this member's own requests and whether they may make one.
 *
 * One call rather than three: the panel needs all of it before it can render a
 * single card, and three round trips would show the grid, then the stats, then
 * the buttons.
 */
export async function GET() {
  const ctx = await indicatorContext();
  if (ctx instanceof NextResponse) return ctx;
  const { db, user, eligible, reason, approved, depositVerified } = ctx;

  const [defs, mine] = await Promise.all([
    db.from("indicator_definitions").select("*").eq("status", "active").order("sort_order"),
    db.from("indicator_access").select("indicator_id,status,tradingview_username,approved_at,expires_at,created_at")
      .eq("user_id", user.id),
  ]);

  if (notInstalled(defs.error?.message)) {
    return NextResponse.json(
      { ok: true, installed: false, indicators: [], message: "Indicators not installed — run supabase/20251004_indicators.sql." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (defs.error) return NextResponse.json({ ok: false, message: defs.error.message }, { status: 502 });

  const byIndicator = new Map((mine.data ?? []).map((r) => [r.indicator_id, r]));

  const indicators = (defs.data ?? []).map((d) => {
    const access = byIndicator.get(d.id) ?? null;
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      description: d.description,
      symbol: d.symbol,
      timeframe: d.timeframe,
      badge: d.badge,
      screenshotUrl: d.screenshot_url,
      /*
       * The figures are omitted entirely unless stats_verified is true, rather
       * than sent with a flag for the UI to respect. A number that is not in the
       * response cannot be rendered by mistake, and these are performance claims
       * about a trading product — the stricter default is the cheap one.
       */
      stats: d.stats_verified
        ? { winRate: d.win_rate, profitFactor: d.profit_factor, testedMonths: d.tested_months }
        : null,
      access: access
        ? {
            status: access.status,
            handle: access.tradingview_username,
            approvedAt: access.approved_at,
            expiresAt: access.expires_at,
            requestedAt: access.created_at,
          }
        : null,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      installed: true,
      indicators,
      // Counted, not claimed: how many members actually hold a live invite.
      eligibility: { eligible, reason, approved, depositVerified },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
