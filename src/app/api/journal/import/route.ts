import { NextResponse } from "next/server";
import { botContext, rateLimited } from "@/lib/botGuard";
import { parseTradesCSV } from "@/lib/journalParser";
import { toImportRows } from "@/lib/statementImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Import a broker statement into the PNL Calendar.
 *
 * Parsed with the same parseTradesCSV the Journal Analytics tab runs in the
 * browser, so the same file yields the same trades in both places — 54 there
 * means 54 here. Unlike that tab, this does upload: the trades are stored on
 * the member's account. The button says so; Journal Analytics keeps its own
 * on-device promise and is not changed by this.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20_000;
const CHUNK = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const ctx = await botContext();
  if (ctx instanceof NextResponse) return ctx;
  const { user, db } = ctx;

  if (rateLimited(`import:${user.id}`, 6, 60_000)) {
    return NextResponse.json({ ok: false, message: "Too many imports — wait a minute." }, { status: 429 });
  }

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ ok: false, message: "Send the statement as multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "No file attached." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, message: "Statement is over 5 MB." }, { status: 413 });

  // Optional: attach the trades to one of the member's own accounts.
  const accountRaw = String(form.get("vt_account_id") ?? "").trim();
  let accountId: string | null = null;
  if (accountRaw) {
    if (!UUID.test(accountRaw)) return NextResponse.json({ ok: false, message: "Bad account id." }, { status: 400 });
    const { data } = await db.from("vt_accounts").select("id").eq("id", accountRaw).eq("user_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, message: "That account is not yours." }, { status: 403 });
    accountId = data.id;
  }

  const trades = parseTradesCSV(await file.text(), file.name).slice(0, MAX_ROWS);
  if (!trades.length) {
    return NextResponse.json(
      { ok: false, message: "No trades found. Export the MT5 History as CSV — the same file Journal Analytics accepts." },
      { status: 422 }
    );
  }

  const { rows, skippedOpen } = toImportRows(trades, user.id, accountId);
  const closedCount = rows.length;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await db
      .from("execution_logs")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "user_id,source,ticket_id", ignoreDuplicates: true })
      .select("id");

    if (error) {
      const setup = /column .* does not exist|violates check constraint|no unique or exclusion constraint/i.test(error.message);
      return NextResponse.json(
        {
          ok: false,
          message: setup ? "PNL tables not installed — run supabase/20250517_pnl_calendar.sql." : error.message,
          inserted,
        },
        { status: setup ? 503 : 502 }
      );
    }
    inserted += data?.length ?? 0;
  }

  const times = rows.map((r) => r.closed_at as string).sort();
  return NextResponse.json(
    {
      ok: true,
      parsed: trades.length,
      closed: closedCount,
      inserted,
      duplicates: closedCount - inserted,
      skippedOpen,
      range: times.length ? { from: times[0], to: times[times.length - 1] } : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
