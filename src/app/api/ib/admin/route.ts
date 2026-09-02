import { NextResponse } from "next/server";
import { getStore, isAdmin, type VerificationStatus } from "@/lib/ibStore";

/*
 * Node, not Edge. The store keeps state in module memory, and each Edge route is
 * its own isolate — a request written by /verify was not visible to /status at
 * all. Node shares module state across routes within an instance, which is the
 * most this can do until a real store is wired.
 */
export const runtime = "nodejs";

/**
 * The review queue.
 *
 * Guarded by `GFXA_ADMIN_TOKEN` compared server-side. With no accounts system in
 * this project an email string would be a guess, not a check — the token is the
 * only guard here that actually holds.
 */

function deny() {
  return NextResponse.json({ ok: false, message: "Not authorised." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!process.env.GFXA_ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, configured: false, message: "GFXA_ADMIN_TOKEN is not set, so the review queue is closed." },
      { status: 503 }
    );
  }
  if (!isAdmin(request)) return deny();

  const store = getStore();
  const all = await store.list();
  const count = (s: VerificationStatus) => all.filter((r) => r.status === s).length;

  return NextResponse.json(
    {
      ok: true,
      durable: store.durable,
      requests: all,
      stats: {
        pending: count("pending"),
        verified: count("verified"),
        rejected: count("rejected"),
        byBroker: all.reduce<Record<string, number>>((acc, r) => {
          acc[r.broker] = (acc[r.broker] ?? 0) + 1;
          return acc;
        }, {}),
        depositsUsd: all.filter((r) => r.status === "verified").reduce((s, r) => s + (r.depositUsd ?? 0), 0),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return deny();

  let body: { id?: string; action?: string; depositUsd?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const action = body.action;
  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ ok: false, message: "Need an id and approve or reject." }, { status: 400 });
  }

  const updated = await getStore().update(id, {
    status: action === "approve" ? "verified" : "rejected",
    // The figure comes from what the admin read in the IB portal; it is left
    // null rather than invented when they did not enter one.
    depositUsd: typeof body.depositUsd === "number" && body.depositUsd >= 0 ? body.depositUsd : null,
    note: (body.note ?? "").trim().slice(0, 300) || null,
    reviewedAt: Date.now(),
  });

  if (!updated) return NextResponse.json({ ok: false, message: "No such request." }, { status: 404 });
  return NextResponse.json({ ok: true, request: updated }, { headers: { "Cache-Control": "no-store" } });
}
