import { NextResponse } from "next/server";
import { adminApi, startOfDay, tableMissing } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["started", "completed_quiz", "joined_channel", "contacted", "verified"] as const;
type Status = (typeof STATUSES)[number];

const COLUMNS =
  "id,telegram_id,telegram_username,name,phone,country,experience,goal,start_param," +
  "utm_source,utm_campaign,utm_content,status,note,contacted_at,joined_channel_at,verified_at,created_at";

interface Lead {
  id: string;
  telegram_id: number | null;
  telegram_username: string | null;
  name: string | null;
  phone: string | null;
  country: string | null;
  experience: string | null;
  goal: string | null;
  start_param: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  status: Status;
  note: string | null;
  contacted_at: string | null;
  joined_channel_at: string | null;
  verified_at: string | null;
  created_at: string;
}

/** One CSV field, quoted so a comma in a goal cannot shift the columns. */
const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * The CRM.
 *
 * Nothing in this repo writes to crm_leads — @gfxa_access_bot runs elsewhere and
 * there is no /api/telegram/webhook here — so until that exists this returns an
 * empty list and `writer: false`, which the console renders as "no bot is
 * feeding this" rather than as "no leads today".
 */
export async function GET(request: Request) {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;

  const p = new URL(request.url).searchParams;
  const range = p.get("range") ?? "all";
  const status = p.get("status");
  const source = p.get("source");
  const campaign = p.get("campaign");
  const q = (p.get("q") ?? "").trim();
  const csv = p.get("format") === "csv";

  let query = db.from("crm_leads").select(COLUMNS).order("created_at", { ascending: false }).limit(csv ? 5000 : 300);

  if (range === "today") query = query.gte("created_at", startOfDay());
  if (range === "week") query = query.gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
  if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (source) query = query.eq("utm_source", source);
  if (campaign) query = query.eq("utm_campaign", campaign);
  if (q) {
    // Escaped: a comma in the term would be read as another or() branch, and a
    // bare % or _ would widen the match.
    const safe = q.replace(/[,%_()]/g, " ").trim();
    if (safe) {
      query = query.or(
        ["name", "phone", "telegram_username", "start_param"].map((c) => `${c}.ilike.%${safe}%`).join(",")
      );
    }
  }

  const { data, error } = await query;

  if (tableMissing(error?.message)) {
    return NextResponse.json(
      {
        ok: true, installed: false, writer: false, leads: [], stats: { total: 0, joined: 0, today: 0 },
        message: "crm_leads does not exist — run supabase/20251003_admin_monitoring.sql.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  const leads = (data ?? []) as unknown as Lead[];

  if (csv) {
    const head = COLUMNS.split(",");
    const body = [head.join(","), ...leads.map((l) => head.map((h) => cell(l[h as keyof Lead])).join(","))].join("\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gfxa-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Counted over the whole table, not the filtered page, so the three headline
  // numbers do not change as someone types in the search box.
  const [total, joined, today] = await Promise.all([
    db.from("crm_leads").select("id", { count: "exact", head: true }),
    db.from("crm_leads").select("id", { count: "exact", head: true })
      .in("status", ["joined_channel", "contacted", "verified"]),
    db.from("crm_leads").select("id", { count: "exact", head: true }).gte("created_at", startOfDay()),
  ]);

  return NextResponse.json(
    {
      ok: true,
      installed: true,
      // The table is there; whether anything fills it is a different question.
      writer: (total.count ?? 0) > 0,
      leads,
      stats: { total: total.count ?? 0, joined: joined.count ?? 0, today: today.count ?? 0 },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Move one lead along the ladder, or attach a note. */
export async function POST(request: Request) {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db, user } = ctx;

  let body: { id?: string; status?: string; note?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "Need a lead id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.status) {
    if (!(STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, message: "Unknown status." }, { status: 400 });
    }
    patch.status = body.status;
    // Stamped here rather than in a trigger so the timestamp records when an
    // admin marked it, which is the thing being audited.
    if (body.status === "contacted") patch.contacted_at = new Date().toISOString();
    if (body.status === "joined_channel") patch.joined_channel_at = new Date().toISOString();
    if (body.status === "verified") patch.verified_at = new Date().toISOString();
  }
  if (typeof body.note === "string") {
    // Attributable: a note with no author is not an audit trail.
    const text = body.note.trim().slice(0, 500);
    patch.note = text ? `${text} — ${user.email}` : null;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, message: "Nothing to change." }, { status: 400 });
  }

  const { data, error } = await db.from("crm_leads").update(patch).eq("id", id).select(COLUMNS).maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });
  if (!data) return NextResponse.json({ ok: false, message: "No such lead." }, { status: 404 });

  return NextResponse.json({ ok: true, lead: data }, { headers: { "Cache-Control": "no-store" } });
}
