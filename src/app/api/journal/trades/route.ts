import { NextResponse } from "next/server";
import { journalContext, needsMigration, notInstalled, toRow, toTrade } from "@/lib/journalApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS =
  "id,symbol,direction,entry_price,exit_price,size,risk_usd,risk_percent,rr,outcome,pnl,fees," +
  "setup_type,mistake_tag,emotion,session,opened_at,closed_at,screenshot_url,notes,created_at";

/** This member's trades. Scoped by user_id on every query, not by trust. */
export async function GET() {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.db
    .from("journal_trades")
    .select(COLUMNS)
    .eq("user_id", ctx.user.id)
    .order("closed_at", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json(
    { ok: true, installed: true, trades: (data ?? []).map((r) => toTrade(r as unknown as Record<string, unknown>)) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 }); }

  const { data, error } = await ctx.db
    .from("journal_trades").insert(toRow(body, ctx.user.id)).select(COLUMNS).single();

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  return NextResponse.json({ ok: true, trade: toTrade(data as unknown as Record<string, unknown>) });
}

export async function PATCH(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 }); }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "Need a trade id." }, { status: 400 });

  const row = toRow(body, ctx.user.id);
  // user_id is never part of an update — the eq() below is what scopes it, and
  // letting the body set it would be the one way to write into another journal.
  delete (row as { user_id?: string }).user_id;

  const { data, error } = await ctx.db
    .from("journal_trades").update(row)
    .eq("id", id).eq("user_id", ctx.user.id)
    .select(COLUMNS).maybeSingle();

  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ ok: false, message: "No such trade." }, { status: 404 });
  return NextResponse.json({ ok: true, trade: toTrade(data as unknown as Record<string, unknown>) });
}

export async function DELETE(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, message: "Need a trade id." }, { status: 400 });

  const { error } = await ctx.db.from("journal_trades").delete().eq("id", id).eq("user_id", ctx.user.id);
  if (notInstalled(error?.message)) return needsMigration;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
