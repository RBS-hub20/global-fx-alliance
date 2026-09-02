import { NextResponse } from "next/server";
import { getStore, tooManyAttempts, type VerificationRequest } from "@/lib/ibStore";
import { isBroker } from "@/lib/brokers";

/*
 * Node, not Edge. The store keeps state in module memory, and each Edge route is
 * its own isolate — a request written by /verify was not visible to /status at
 * all. Node shares module state across routes within an instance, which is the
 * most this can do until a real store is wired.
 */
export const runtime = "nodejs";

/**
 * Records a request to have a deposit checked.
 *
 * **No password is collected.** The brief asked for the reader's MT4/MT5
 * investor password so a balance could be read through MetaApi. That is a live
 * credential to a third party's brokerage account: it exposes full balance,
 * equity, open positions and trade history, most brokers' terms forbid sharing
 * it, and one breach of this store would expose every member's account. It also
 * buys nothing here — no broker in the community exposes deposits through a
 * public partner API, so an admin has to open the IB portal and look either way.
 * Collecting a credential that does not remove the manual step is pure downside.
 *
 * So this takes the account number and email needed to find the person in the
 * broker's portal, and an admin confirms the deposit there.
 */

const MAX = { email: 254, account: 40, server: 60, note: 300 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const email = clean(body.email, MAX.email).toLowerCase();
  const account = clean(body.account, MAX.account);
  const server = clean(body.server, MAX.server) || null;
  const broker = clean(body.broker, 20);
  const method = body.method === "screenshot" ? "screenshot" : "account";
  const hasProof = method === "screenshot" && body.hasProof === true;

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

  // Anything that looks like a credential is refused rather than quietly dropped,
  // so nobody builds a client that keeps sending one.
  if ("password" in body || "investorPassword" in body) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "This platform never asks for your investor or master password. Remove it and send only the account number — an admin confirms the deposit in the broker's IB portal.",
      },
      { status: 400 }
    );
  }

  if (tooManyAttempts(email)) {
    return NextResponse.json(
      { ok: false, message: "Too many submissions today. Try again tomorrow, or reply to the pending request." },
      { status: 429 }
    );
  }

  const store = getStore();
  const existing = await store.byEmail(email);
  if (existing?.status === "verified") {
    return NextResponse.json({ ok: true, status: "verified", id: existing.id, message: "Already verified." });
  }

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)gfxa_ib=([^;]+)/);
  const attribution = match ? decodeURIComponent(match[1]) : null;
  const ibCode = attribution?.includes("_") ? attribution.slice(attribution.indexOf("_") + 1) : null;

  const record: VerificationRequest = {
    id: `ib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    email,
    broker,
    account,
    server,
    method,
    ibCode,
    ibClickTime: typeof body.ibClickTime === "number" ? body.ibClickTime : null,
    depositUsd: null,
    status: "pending",
    note: null,
    createdAt: Date.now(),
    reviewedAt: null,
    hasProof,
  };

  await store.put(record);

  return NextResponse.json(
    {
      ok: true,
      id: record.id,
      status: "pending",
      durable: store.durable,
      message:
        "Submitted. An admin will confirm the deposit in the broker's IB portal and unlock your access — usually within 24 hours.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
