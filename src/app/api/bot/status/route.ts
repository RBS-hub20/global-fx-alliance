import { NextResponse } from "next/server";
import { botContext } from "@/lib/botGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current engine state plus the member's linked accounts, minus every secret. */
export async function GET(request: Request) {
  const ctx = await botContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  const symbol = new URL(request.url).searchParams.get("symbol") ?? "XAUUSD";

  /*
   * Sweep this member's stale proposals on the way past.
   *
   * The nightly cron in vercel.json is a backstop, not the mechanism. Vercel's
   * Hobby plan refuses any cron more frequent than daily — the deployment
   * itself fails to build — so a minute-by-minute sweep cannot be relied on
   * here without a plan upgrade. Doing it on read costs one indexed update and
   * keeps the panel correct on every plan.
   *
   * This is display hygiene only. /api/bot/approve re-checks expires_at before
   * it sends anything, so a row this never reaches still cannot be executed
   * late.
   */
  await db.from("execution_logs")
    .update({ status: "EXPIRED" })
    .eq("user_id", user.id)
    .eq("status", "PENDING_APPROVAL")
    .lt("expires_at", new Date().toISOString());

  const [status, accounts] = await Promise.all([
    db.from("bot_status").select("*").eq("user_id", user.id).eq("current_symbol", symbol).maybeSingle(),
    // Columns named explicitly. `select("*")` here holds the service key, which
    // is not bound by the column grants that stop the browser reading ciphertext.
    db.from("vt_accounts")
      .select("id, account_number, server, status, balance, telegram_id, auto_execute_enabled, last_connected_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const missing = [status.error, accounts.error].find((e) => e && /does not exist/i.test(e.message));
  if (missing) {
    return NextResponse.json(
      { ok: false, message: "Bot tables not installed — run supabase/20250515_ai_execution_bot.sql." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      status: status.data ?? null,
      accounts: accounts.data ?? [],
      hasMaster: null, // deliberately not derived from ciphertext presence in a GET
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
