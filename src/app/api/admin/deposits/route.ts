import { NextResponse } from "next/server";
import { adminApi, startOfDay } from "@/lib/adminGate";
import { listRequests, signProof, updateStatus } from "@/lib/ibStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Broker deposit proofs.
 *
 * The same queue /api/ib/admin serves, reached through the email allow-list
 * instead of the shared header token — so an admin can work it from a browser
 * without a secret being pasted into one. The store functions are shared, which
 * keeps one definition of what approving means.
 */
export async function GET() {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { db } = ctx;

  const [pending, verified] = await Promise.all([listRequests("pending"), listRequests("verified")]);
  if (!pending.ok) return NextResponse.json({ ok: false, message: pending.error }, { status: 502 });

  const since = startOfDay();
  const approvedToday = (verified.data ?? []).filter((r) => r.reviewedAt && new Date(r.reviewedAt).toISOString() >= since);

  /*
   * Proof URLs are minted here, five minutes at a time, only for the rows the
   * reviewer is about to look at. Signing the whole table would put a working
   * link to every member's account screenshot into one JSON response.
   */
  const rows = await Promise.all(
    (pending.data ?? []).slice(0, 40).map(async (r) => ({
      id: r.id,
      email: r.email,
      broker: r.broker,
      account: r.account,
      server: r.server,
      method: r.method,
      ibCode: r.ibCode,
      createdAt: r.createdAt,
      proofUrl: r.proofPath ? await signProof(r.proofPath) : null,
    }))
  );

  const total = await db.from("verified_users").select("id", { count: "exact", head: true });

  return NextResponse.json(
    {
      ok: true,
      pending: rows,
      stats: {
        pending: (pending.data ?? []).length,
        verifiedTotal: (verified.data ?? []).length,
        approvedToday: approvedToday.length,
        allTime: total.count ?? 0,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const ctx = await adminApi();
  if (ctx instanceof NextResponse) return ctx;
  const { user } = ctx;

  let body: { id?: string; action?: string; depositUsd?: number; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, message: "Need a request id." }, { status: 400 });
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ ok: false, message: "action must be approve or reject." }, { status: 400 });
  }

  const result = body.action === "approve"
    ? await updateStatus(id, "verified", {
        // The figure the reviewer read in the broker's IB portal, not one the
        // applicant typed. Undefined leaves the column alone.
        depositUsd: typeof body.depositUsd === "number" ? body.depositUsd : undefined,
        reason: `Approved by ${user.email}`,
      })
    : await updateStatus(id, "rejected", {
        reason: `${(body.reason ?? "").trim().slice(0, 300) || "No reason given"} — ${user.email}`,
      });

  if (!result.ok) return NextResponse.json({ ok: false, message: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, request: result.data }, { headers: { "Cache-Control": "no-store" } });
}
