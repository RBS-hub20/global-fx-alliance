import { NextResponse } from "next/server";
import { journalContext, needsMigration, notInstalled } from "@/lib/journalApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Community averages, and whether this member is contributing to them.
 *
 * Not a leaderboard, and there is no endpoint that returns one. The RPC returns
 * a single row of averages and refuses to return any at all below five
 * contributors — see the migration for why five.
 */
export async function GET() {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  const [stats, mine] = await Promise.all([
    ctx.db.rpc("journal_community_stats"),
    ctx.db.from("journal_settings").select("share_anonymous").eq("user_id", ctx.user.id).maybeSingle(),
  ]);

  if (notInstalled(stats.error?.message) || /function .* does not exist/i.test(stats.error?.message ?? "")) {
    return needsMigration;
  }
  if (stats.error) return NextResponse.json({ ok: false, message: stats.error.message }, { status: 502 });

  const row = (Array.isArray(stats.data) ? stats.data[0] : stats.data) as Record<string, unknown> | undefined;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  return NextResponse.json(
    {
      ok: true,
      installed: true,
      sharing: mine.data?.share_anonymous === true,
      contributors: Number(row?.contributors ?? 0),
      minimum: Number(row?.minimum ?? 5),
      // Null until the floor is met. The UI says how many more are needed
      // rather than drawing a comparison against nothing.
      average: row?.avg_win_rate === null || row?.avg_win_rate === undefined ? null : {
        winRate: n(row.avg_win_rate),
        profitFactor: n(row.avg_profit_factor),
        expectancy: n(row.avg_expectancy),
        avgWin: n(row.avg_win),
        avgLoss: n(row.avg_loss),
        trades: n(row.avg_trades),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Opt in or out of contributing. */
export async function PUT(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { share?: unknown };
  try { body = (await request.json()) as typeof body; }
  catch { return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 }); }

  const { error } = await ctx.db.from("journal_settings").upsert(
    { user_id: ctx.user.id, share_anonymous: body.share === true, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, sharing: body.share === true });
}
