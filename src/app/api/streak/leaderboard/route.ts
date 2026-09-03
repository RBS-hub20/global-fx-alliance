import { NextResponse } from "next/server";
import { getLeaderboard, type LeaderSort } from "@/lib/streak";

export const runtime = "nodejs";

/** Public board. Handles only — the addresses never leave the server. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Number.parseInt(params.get("limit") ?? "10", 10);
  const raw = params.get("sort");
  const sort: LeaderSort =
    raw === "rep_earned" || raw === "longest_streak" ? raw : "current_streak";

  const rows = await getLeaderboard(Number.isFinite(limit) ? limit : 10, sort);

  return NextResponse.json(
    { ok: true, sort, rows },
    { headers: { "Cache-Control": "public, s-maxage=30" } }
  );
}
