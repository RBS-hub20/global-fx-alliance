import { NextResponse } from "next/server";
import { cleanHandle, indicatorContext, notInstalled, requireEligible } from "@/lib/indicatorGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ask to be added to an invite-only script.
 *
 * Writes a pending row and nothing else. The invite itself is a manual step in
 * TradingView's own interface — there is no public API for adding a user to an
 * invite-only script, so an admin pastes the handle from the Indicators tab.
 * Pretending otherwise would mean a member sat waiting on an automation that
 * does not exist.
 */
export async function POST(request: Request) {
  const ctx = await indicatorContext();
  if (ctx instanceof NextResponse) return ctx;

  // Both gates: approved membership and a verified deposit.
  const denied = requireEligible(ctx);
  if (denied) return denied;

  const { db, user } = ctx;

  let body: { slug?: string; tradingviewUsername?: string; telegramId?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim();
  if (!slug) return NextResponse.json({ ok: false, message: "Which indicator?" }, { status: 400 });

  const handle = cleanHandle(body.tradingviewUsername);
  if (!handle) {
    return NextResponse.json(
      { ok: false, message: "That does not look like a TradingView username — letters, digits and underscores, 2–25 characters." },
      { status: 400 }
    );
  }

  const def = await db.from("indicator_definitions").select("id,name,status").eq("slug", slug).maybeSingle();
  if (notInstalled(def.error?.message)) {
    return NextResponse.json({ ok: false, message: "Indicators are not installed yet." }, { status: 503 });
  }
  if (!def.data || def.data.status !== "active") {
    return NextResponse.json({ ok: false, message: "No such indicator." }, { status: 404 });
  }

  const existing = await db.from("indicator_access").select("id,status")
    .eq("user_id", user.id).eq("indicator_id", def.data.id).maybeSingle();

  if (existing.data?.status === "approved") {
    return NextResponse.json(
      { ok: true, already: "approved", message: `You already have access to ${def.data.name}.` },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (existing.data?.status === "pending") {
    /*
     * Still pending, but let the handle be corrected — a typo in a TradingView
     * username is the one thing that makes a request unactionable, and making
     * someone wait for a rejection to fix it is pointless.
     */
    const { error } = await db.from("indicator_access")
      .update({ tradingview_username: handle }).eq("id", existing.data.id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
    return NextResponse.json(
      { ok: true, already: "pending", message: "Your request is already in the queue — username updated." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // New request, or a previously revoked row being asked for again.
  const payload = {
    user_id: user.id,
    indicator_id: def.data.id,
    tradingview_username: handle,
    telegram_id: typeof body.telegramId === "number" ? body.telegramId : null,
    status: "pending",
    approved_at: null,
    expires_at: null,
  };

  const { error } = await db.from("indicator_access")
    .upsert(payload, { onConflict: "user_id,indicator_id" });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json(
    { ok: true, status: "pending", message: `Request sent — an admin will add ${handle} to ${def.data.name}.` },
    { headers: { "Cache-Control": "no-store" } }
  );
}
