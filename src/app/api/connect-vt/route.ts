import { NextResponse } from "next/server";
import { botContext, rateLimited } from "@/lib/botGuard";
import { credentialAad, encrypt, encryptionReady } from "@/lib/encrypt";
import { testConnect, vpsReady } from "@/lib/vpsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Links a VT Markets account to the signed-in member.
 *
 * The password reaches this route, is verified against MT5, is encrypted, and
 * is never written to a log, an error message or the response. The only place
 * it exists at rest is the ciphertext column, which the browser cannot select.
 */
export async function POST(request: Request) {
  const ctx = await botContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  if (rateLimited(`connect:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, message: "Too many attempts — wait a minute." }, { status: 429 });
  }
  if (!encryptionReady()) {
    return NextResponse.json({ ok: false, message: "ENCRYPTION_KEY is not set — cannot store credentials." }, { status: 503 });
  }
  if (!vpsReady()) {
    return NextResponse.json({ ok: false, message: "VPS bridge is not configured." }, { status: 503 });
  }

  let body: {
    account_number?: string; password?: string; password_type?: string;
    server?: string; telegram_id?: string; auto_execute_enabled?: boolean;
    master_ack?: boolean;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const accountNumber = (body.account_number ?? "").trim();
  const password = body.password ?? "";
  const passwordType = body.password_type === "master" ? "master" : "investor";
  const server = body.server === "VTMarkets-Demo" ? "VTMarkets-Demo" : "VTMarkets-Live";
  const telegramId = (body.telegram_id ?? "").trim() || null;
  const autoExecute = !!body.auto_execute_enabled;

  if (!/^[0-9]{6,10}$/.test(accountNumber)) {
    return NextResponse.json({ ok: false, message: "Account number must be 6–10 digits." }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json({ ok: false, message: "Enter the account password." }, { status: 400 });
  }

  /*
   * Auto-execute needs a master password AND the acknowledgement, checked here
   * and again by a table constraint. An investor password is read-only at the
   * broker, so an "auto-execute" account configured with one would sit there
   * looking armed and silently never trade.
   */
  if (autoExecute && passwordType !== "master") {
    return NextResponse.json({ ok: false, message: "Auto-execute needs the master password — an investor password cannot place orders." }, { status: 400 });
  }
  if (autoExecute && !body.master_ack) {
    return NextResponse.json({ ok: false, message: "Tick the acknowledgement before enabling auto-execute." }, { status: 400 });
  }

  // Verified before storage: an account that cannot log in should not leave a
  // credential sitting in the database.
  const probe = await testConnect({ accountNumber, password, server, passwordType });
  if (!probe.ok || !probe.data?.connected) {
    return NextResponse.json(
      { ok: false, message: probe.data?.message ?? probe.error ?? "VT Markets refused those details." },
      { status: probe.status === 503 ? 503 : 400 }
    );
  }

  const aad = credentialAad(user.id, accountNumber, server);
  const sealed = encrypt(password, aad);

  const row: Record<string, unknown> = {
    user_id: user.id,
    account_number: accountNumber,
    server,
    telegram_id: telegramId,
    status: "connected",
    balance: probe.data.balance ?? 0,
    last_connected_at: new Date().toISOString(),
    auto_execute_enabled: autoExecute,
  };

  if (passwordType === "master") {
    row.master_password_encrypted = sealed.payload;
    row.master_iv = sealed.iv;
    // NOT NULL on the table, and a master password is a superset of investor
    // access, so it stands in for both rather than forcing a second entry.
    row.investor_password_encrypted = sealed.payload;
    row.investor_iv = sealed.iv;
  } else {
    row.investor_password_encrypted = sealed.payload;
    row.investor_iv = sealed.iv;
  }

  const { data, error } = await db
    .from("vt_accounts")
    .upsert(row, { onConflict: "user_id,account_number,server" })
    .select("id, account_number, server, balance, status, auto_execute_enabled, last_connected_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: /relation .* does not exist/i.test(error.message)
        ? "Bot tables not installed — run supabase/20250515_ai_execution_bot.sql."
        : error.message },
      { status: 502 }
    );
  }

  // The response deliberately carries no credential material of any kind.
  return NextResponse.json(
    { ok: true, account_id: data.id, balance: Number(data.balance), account: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
