import { NextResponse } from "next/server";
import { getStore } from "@/lib/ibStore";

/*
 * Node, not Edge. The store keeps state in module memory, and each Edge route is
 * its own isolate — a request written by /verify was not visible to /status at
 * all. Node shares module state across routes within an instance, which is the
 * most this can do until a real store is wired.
 */
export const runtime = "nodejs";

/** Where one applicant's request stands. Returns nothing that isn't theirs. */
export async function GET(request: Request) {
  const email = (new URL(request.url).searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ verified: false, status: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const record = await getStore().byEmail(email);
  if (!record) {
    return NextResponse.json({ verified: false, status: null }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      verified: record.status === "verified",
      status: record.status,
      broker: record.broker,
      account: record.account,
      depositUsd: record.depositUsd,
      note: record.note,
      createdAt: record.createdAt,
      reviewedAt: record.reviewedAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
