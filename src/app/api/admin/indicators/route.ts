import { NextResponse } from "next/server";
import { adminApi, tableMissing } from "@/lib/adminGate";
import { ACCESS_DAYS, expiryFrom } from "@/lib/indicatorGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Indicator invite management.
 *
 * Management only — the showcase members see lives at /dashboard?tab=indicators.
 * What happens here is the part that cannot be automated: TradingView has no
 * public API for adding a username to an invite-only script, so this hands the
 * reviewer the handle to paste and records the decision.
 */
export async function GET(request: Request) {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;

  const p = new URL(request.url).searchParams;
  const status = p.get("status");
  const q = (p.get("q") ?? "").trim();

  let query = db
    .from("indicator_access")
    .select("id,user_id,telegram_id,tradingview_username,status,note,approved_at,expires_at,created_at,indicator_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (status && ["pending", "approved", "revoked"].includes(status)) query = query.eq("status", status);
  if (q) {
    const safe = q.replace(/[,%_()]/g, " ").trim();
    if (safe) query = query.ilike("tradingview_username", `%${safe}%`);
  }

  const [rows, defs] = await Promise.all([
    query,
    db.from("indicator_definitions").select("id,slug,name,symbol,timeframe,status,stats_verified,win_rate,profit_factor,tested_months").order("sort_order"),
  ]);

  if (tableMissing(rows.error?.message) || tableMissing(defs.error?.message)) {
    return NextResponse.json(
      { ok: true, installed: false, requests: [], indicators: [], stats: { pending: 0, approved: 0, revoked: 0 },
        message: "Indicator tables not installed — run supabase/20251004_indicators.sql." },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (rows.error) return NextResponse.json({ ok: false, message: rows.error.message }, { status: 502 });

  const access = rows.data ?? [];
  const definitions = defs.data ?? [];
  const defById = new Map(definitions.map((d) => [d.id, d]));

  /*
   * profiles has no foreign key to indicator_access.user_id — both point at
   * auth.users — so PostgREST cannot embed it. Fetched and mapped instead,
   * limited to the ids actually on screen.
   */
  const ids = Array.from(new Set(access.map((r) => r.user_id)));
  const emails = ids.length
    ? await db.from("profiles").select("id,email,status").in("id", ids)
    : { data: [] as { id: string; email: string; status: string }[] };
  const profileById = new Map((emails.data ?? []).map((r) => [r.id, r]));

  const requests = access.map((r) => {
    const d = defById.get(r.indicator_id);
    const profile = profileById.get(r.user_id);
    return {
      id: r.id,
      email: profile?.email ?? "(no profile row)",
      memberStatus: profile?.status ?? null,
      telegramId: r.telegram_id,
      handle: r.tradingview_username,
      slug: d?.slug ?? "(deleted)",
      indicator: d?.name ?? "(deleted indicator)",
      status: r.status,
      note: r.note,
      approvedAt: r.approved_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      // Surfaced so an invite that lapsed is visibly different from one revoked.
      expired: !!r.expires_at && new Date(r.expires_at) < new Date(),
    };
  });

  const counts = { pending: 0, approved: 0, revoked: 0 } as Record<string, number>;
  const perIndicator = new Map<string, { slug: string; name: string; pending: number; approved: number; revoked: number }>();
  for (const d of definitions) perIndicator.set(d.id, { slug: d.slug, name: d.name, pending: 0, approved: 0, revoked: 0 });
  // Counted over the whole table rather than the filtered page, so the headline
  // numbers do not move while someone types in the search box.
  const all = await db.from("indicator_access").select("status,indicator_id").limit(5000);
  for (const r of all.data ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    const agg = perIndicator.get(r.indicator_id);
    if (agg) agg[r.status as "pending" | "approved" | "revoked"] += 1;
  }

  return NextResponse.json(
    {
      ok: true,
      installed: true,
      requests,
      indicators: definitions.map((d) => {
        const agg = perIndicator.get(d.id);
        return {
          slug: d.slug, name: d.name, symbol: d.symbol, timeframe: d.timeframe, status: d.status,
          statsVerified: d.stats_verified,
          // Shown to the admin either way: they are the person who decides
          // whether these are publishable.
          winRate: d.win_rate, profitFactor: d.profit_factor, testedMonths: d.tested_months,
          pending: agg?.pending ?? 0, approved: agg?.approved ?? 0, revoked: agg?.revoked ?? 0,
        };
      }),
      stats: { pending: counts.pending ?? 0, approved: counts.approved ?? 0, revoked: counts.revoked ?? 0, accessDays: ACCESS_DAYS },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Approve (starts the 365-day clock) or revoke. */
export async function POST(request: Request) {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db, user } = ctx;

  let body: { id?: string; action?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "Need a request id." }, { status: 400 });
  if (body.action !== "approve" && body.action !== "revoke") {
    return NextResponse.json({ ok: false, message: "action must be approve or revoke." }, { status: 400 });
  }

  const now = new Date();
  const note = (body.note ?? "").trim().slice(0, 300);

  const patch = body.action === "approve"
    ? {
        status: "approved",
        approved_at: now.toISOString(),
        expires_at: expiryFrom(now),
        note: `Approved by ${user.email}${note ? ` — ${note}` : ""}`,
      }
    : {
        status: "revoked",
        /*
         * approved_at is kept. It is the record of when they did have access,
         * which is what makes a revocation auditable — clearing it would leave
         * no trace that an invite was ever granted.
         */
        expires_at: now.toISOString(),
        note: `Revoked by ${user.email}${note ? ` — ${note}` : ""}`,
      };

  const { data, error } = await db.from("indicator_access").update(patch).eq("id", id)
    .select("id,status,tradingview_username,approved_at,expires_at").maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ ok: false, message: "No such request." }, { status: 404 });

  return NextResponse.json(
    {
      ok: true,
      request: data,
      // The reminder that the actual grant is a manual step in TradingView.
      reminder: body.action === "approve"
        ? `Add ${data.tradingview_username} to the invite-only script in TradingView.`
        : `Remove ${data.tradingview_username} from the invite-only script in TradingView.`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
