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
