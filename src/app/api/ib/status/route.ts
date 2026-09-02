import { NextResponse } from "next/server";
import { getByEmail, storeReady } from "@/lib/ibStore";

export const runtime = "nodejs";

/** Access lapses 30 days after approval and is re-checked against the portal. */
const ACCESS_DAYS = 30;

/** Where one applicant's request stands. Returns nothing that isn't theirs. */
export async function GET(request: Request) {
  const email = (new URL(request.url).searchParams.get("email") ?? "").trim().toLowerCase();
  const nothing = { verified: false, status: null };

  if (!email || !storeReady()) {
    return NextResponse.json(nothing, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await getByEmail(email);
  if (error || !data) {
    return NextResponse.json(nothing, { headers: { "Cache-Control": "no-store" } });
  }

  const expiresAt = data.reviewedAt ? data.reviewedAt + ACCESS_DAYS * 86400_000 : null;
  const expired = data.status === "verified" && expiresAt !== null && Date.now() > expiresAt;

  return NextResponse.json(
    {
      verified: data.status === "verified" && !expired,
      status: expired ? "expired" : data.status,
      broker: data.broker,
      account: data.account,
      depositUsd: data.depositUsd,
      note: data.note,
      createdAt: data.createdAt,
      reviewedAt: data.reviewedAt,
      expiresAt,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
