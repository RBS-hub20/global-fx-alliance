import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { handleFor } from "@/lib/handle";

export const runtime = "nodejs";

/**
 * Community shoutbox.
 *
 * Posts are stored against the email but **published under a derived handle** —
 * a public channel must not carry members' addresses, and masking to
 * `renz***@gmail.com` still identifies someone in a community this size while
 * handing anyone the string needed to impersonate them.
 *
 * With no authentication the email is taken on trust, so a determined visitor
 * can post under someone else's handle. That is the honest limit of this
 * feature until accounts exist, and it is why nothing here is treated as
 * attributable.
 *
 * The handle is **derived on read**, never selected from the table. Selecting it
 * made the whole channel depend on a column that a table created from an earlier
 * schema does not have — and on PostgREST having noticed it — which is exactly
 * how "Could not find the 'handle' column of 'shoutbox' in the schema cache"
 * took the feature down. It is still written when the column exists, because
 * a stored copy is useful for querying in the dashboard, but nothing reads it.
 */

const TABLE = "shoutbox";
const MAX_MESSAGE = 200;
const RATE_PER_MIN = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Row {
  id: string;
  email: string;
  message: string;
  created_at: string;
}

/** Derived every time, so the column is an optimisation rather than a dependency. */
const publicShape = (r: Row) => ({
  id: r.id,
  handle: handleFor(r.email),
  message: r.message,
  createdAt: r.created_at,
});

const COLUMNS = "id,email,message,created_at";

export async function GET() {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: true, messages: [] }, { headers: { "Cache-Control": "no-store" } });

  const { data, error } = await db
    .from(TABLE)
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(20);

  /*
   * A missing table is "not set up yet", not a fault: before
   * supabase/retention.sql is run this is every dashboard load, and a 502 there
   * fills the console with errors on a page that is otherwise fine. The read
   * degrades to empty; POST still reports the real reason, so the operator sees
   * it the moment anyone tries to post.
   */
  if (error) {
    return NextResponse.json(
      { ok: true, messages: [], configured: false, message: error.message },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Newest last, so the client renders a transcript without re-sorting.
  return NextResponse.json(
    { ok: true, messages: ((data ?? []) as Row[]).map(publicShape).reverse() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  // Consistent with the verification form: this platform never wants one, and
  // a chat box is exactly where someone might paste one by accident.
  if ("password" in body || "investorPassword" in body || "investor_password" in body) {
    return NextResponse.json(
      { ok: false, message: "Never post a password anywhere — including here." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";

  if (!EMAIL.test(email)) {
    return NextResponse.json({ ok: false, message: "Add your email first." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, message: "Say something first." }, { status: 400 });
  }
  if (/\b[\w.+-]+@[\w-]+\.\w{2,}\b/.test(message)) {
    return NextResponse.json(
      { ok: false, message: "Leave email addresses out of the channel — it is public." },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "The channel is offline." }, { status: 503 });

  // Counted in the table so it holds across instances.
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_PER_MIN) {
    return NextResponse.json(
      { ok: false, message: `Slow down — ${RATE_PER_MIN} messages a minute.` },
      { status: 429 }
    );
  }

  /*
   * `handle` is written when the table has it and dropped when it does not — a
   * table built from the earlier schema has no such column, and losing the post
   * over a denormalised copy of something we can always recompute would be the
   * wrong trade.
   */
  let payload: Record<string, unknown> = { email, handle: handleFor(email), message };
  let data: Row | null = null;
  let error: { message: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await db.from(TABLE).insert(payload).select(COLUMNS).single();
    if (!res.error) { data = res.data as Row; error = null; break; }
    error = res.error;
    if (/Could not find the 'handle' column/.test(res.error.message)) {
      const { handle: _dropped, ...rest } = payload;
      payload = rest;
      continue;
    }
    break;
  }

  if (error || !data) {
    return NextResponse.json({ ok: false, message: error?.message ?? "Could not post." }, { status: 502 });
  }

  return NextResponse.json(
    { ok: true, post: publicShape(data) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
