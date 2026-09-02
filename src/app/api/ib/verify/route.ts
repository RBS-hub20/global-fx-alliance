import { NextResponse } from "next/server";
import { countRecent, createRequest, getByEmail, storeReady, uploadProof } from "@/lib/ibStore";
import { isBroker } from "@/lib/brokers";

export const runtime = "nodejs";

/**
 * Records a request to have a deposit checked.
 *
 * **No password is collected.** The original brief asked for the reader's MT4/MT5
 * investor password so a balance could be read through MetaApi. That is a live
 * credential to a third party's brokerage account — full balance, equity, open
 * positions and trade history — most brokers' terms forbid sharing it, and one
 * breach of this table would expose every member's account. It also buys nothing:
 * no broker in the community exposes deposits through a public partner API, so an
 * admin opens the IB portal and looks either way.
 */

const MAX = { email: 254, account: 40, server: 60 };
const MAX_PROOF_BYTES = 5_000_000;
const RATE_LIMIT = 5;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Decodes a data URL, refusing anything that is not an image we accept. */
function decodeProof(raw: unknown): { bytes: Uint8Array; contentType: string } | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!m) return null;
  try {
    const buf = Buffer.from(m[3], "base64");
    if (!buf.length || buf.length > MAX_PROOF_BYTES) return null;
    return { bytes: new Uint8Array(buf), contentType: m[1] };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  // Refused loudly rather than quietly dropped, so no client starts sending one.
  if ("password" in body || "investorPassword" in body || "investor_password" in body) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "We never ask for your investor or master password — anyone asking you for a trading password is not us. Send only the account number; an admin confirms the deposit in the broker's IB portal.",
      },
      { status: 400 }
    );
  }

  const email = clean(body.email, MAX.email).toLowerCase();
  const account = clean(body.account ?? body.account_number, MAX.account);
  const server = clean(body.server, MAX.server) || null;
  const broker = clean(body.broker, 20);

  if (!EMAIL.test(email)) {
    return NextResponse.json({ ok: false, message: "That email address doesn't look right." }, { status: 400 });
  }
  if (!isBroker(broker)) {
    return NextResponse.json({ ok: false, message: "Choose one of the three brokers." }, { status: 400 });
  }
  if (account.length < 4) {
    return NextResponse.json(
      { ok: false, message: "Enter the trading account number shown in your terminal." },
      { status: 400 }
    );
  }

  if (!storeReady()) {
    return NextResponse.json(
      { ok: false, message: "Verification is not accepting submissions right now. Try again shortly." },
      { status: 503 }
    );
  }

  const existing = await getByEmail(email);
  if (existing.data?.status === "verified") {
    return NextResponse.json({ ok: true, id: existing.data.id, status: "verified", message: "Already verified." });
  }

  // Counted in the table, so the limit holds across instances rather than
  // throttling only whichever lambda happens to answer.
  if ((await countRecent(email)) >= RATE_LIMIT) {
    return NextResponse.json(
      { ok: false, message: `Too many submissions today — ${RATE_LIMIT} per day. Try again tomorrow.` },
      { status: 429 }
    );
  }

  let proofPath: string | null = null;
  const proof = decodeProof(body.screenshot ?? body.proof);
  if (proof) {
    const up = await uploadProof(email, proof.bytes, proof.contentType);
    if (!up.ok) {
      return NextResponse.json(
        { ok: false, message: `Could not store the screenshot: ${up.error}` },
        { status: 502 }
      );
    }
    proofPath = up.data;
  }

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)gfxa_ib=([^;]+)/);
  const attribution = match ? decodeURIComponent(match[1]) : null;
  const cookieCode = attribution?.includes("_") ? attribution.slice(attribution.indexOf("_") + 1) : null;

  const created = await createRequest({
    email,
    broker,
    account,
    server,
    method: proofPath ? "screenshot" : "form",
    ibCode: clean(body.ib_code ?? body.ibCode, 60) || cookieCode,
    ibClickTime: typeof body.ibClickTime === "number" ? body.ibClickTime : null,
    proofPath,
  });

  if (!created.ok) {
    return NextResponse.json(
      { ok: false, message: `Could not record the request: ${created.error}` },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: created.data!.id,
      status: "pending",
      durable: true,
      // Present when the table is missing columns; harmless for the applicant,
      // a prompt for the operator to run supabase/verified_users.sql.
      droppedColumns: created.droppedColumns?.length ? created.droppedColumns : undefined,
      message:
        "Submitted. An admin will confirm the deposit in the broker's IB portal and unlock your access — usually within 24 hours.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
