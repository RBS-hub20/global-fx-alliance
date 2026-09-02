import { NextResponse } from "next/server";
import {
  isAdmin, listRequests, signProof, storeReady,
  type VerificationStatus,
} from "@/lib/ibStore";
import { reviewFrom } from "@/lib/ibReview";

export const runtime = "nodejs";

/**
 * The review queue.
 *
 * Guarded by `GFXA_ADMIN_TOKEN` compared server-side, sent as a header. With no
 * accounts system in this project an email string would be a guess, not a check.
 *
 * The token is deliberately **not** accepted from a query string: this app runs
 * Vercel Analytics, which records page URLs, so a token in the URL would be
 * copied into analytics, browser history and any referrer.
 */

function deny() {
  return NextResponse.json({ ok: false, message: "Invalid token." }, { status: 401 });
}

function closed() {
  return NextResponse.json(
    { ok: false, configured: false, message: "Queue closed — GFXA_ADMIN_TOKEN is not set." },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  if (!process.env.GFXA_ADMIN_TOKEN) return closed();
  if (!isAdmin(request)) return deny();

  if (!storeReady()) {
    return NextResponse.json(
      { ok: false, message: "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const params = new URL(request.url).searchParams;
  const filter = params.get("status");
  const status = (["pending", "verified", "rejected"] as const).find((s) => s === filter);

  const { data, error } = await listRequests(status);
  if (error) return NextResponse.json({ ok: false, message: error }, { status: 502 });

  const all = data ?? [];
  const count = (s: VerificationStatus) => all.filter((r) => r.status === s).length;

  const byBroker: Record<string, { pending: number; verified: number; rejected: number }> = {};
  for (const r of all) {
    byBroker[r.broker] ??= { pending: 0, verified: 0, rejected: 0 };
    byBroker[r.broker][r.status] += 1;
  }

  // Signed on the way out so a reviewer can open a proof without the bucket
  // being public. Five minutes, minted per request.
  const requests = await Promise.all(
    all.map(async (r) => ({
      ...r,
      proofPath: undefined,
      proofUrl: r.proofPath ? await signProof(r.proofPath) : null,
    }))
  );

  return NextResponse.json(
    {
      ok: true,
      durable: true,
      backend: "supabase",
      requests,
      stats: {
        pending: count("pending"),
        verified: count("verified"),
        rejected: count("rejected"),
        byBroker,
        depositsUsd: all.filter((r) => r.status === "verified").reduce((s, r) => s + (r.depositUsd ?? 0), 0),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  return reviewFrom(request);
}
