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
 */

const TABLE = "shoutbox";
const MAX_MESSAGE = 200;
const RATE_PER_MIN = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Row {
  id: string;
  handle: string | null;
  email: string;
  message: string;
  created_at: string;
}

const publicShape = (r: Row) => ({
  id: r.id,
  handle: r.handle || handleFor(r.email),
  message: r.message,
  createdAt: r.created_at,
});

export async function GET() {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: true, messages: [] }, { headers: { "Cache-Control": "no-store" } });

  const { data, error } = await db
    .from(TABLE)
    .select("id,handle,email,message,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ ok: false, messages: [], message: error.message }, { status: 502 });

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

  const { data, error } = await db
    .from(TABLE)
    .insert({ email, handle: handleFor(email), message })
    .select("id,handle,email,message,created_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 502 });

  return NextResponse.json(
    { ok: true, post: publicShape(data as Row) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
