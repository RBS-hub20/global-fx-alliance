import { NextResponse } from "next/server";
import { activeToday, checkIn, getStreak } from "@/lib/streak";
import { handleFor } from "@/lib/handle";

export const runtime = "nodejs";

/**
 * Daily check-in.
 *
 * There is no authentication in this project, so the email is taken on trust —
 * anyone can check in as any address. That inflates a streak; it exposes
 * nothing, since the response carries only that address's own numbers and a
 * derived handle. Worth closing with real accounts before the leaderboard is
 * promoted as a competition.
 *
 * The once-a-day limit is the stored `last_checkin` date rather than a counter,
 * so it holds across instances and cannot be reset by a redeploy.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const readEmail = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "";
  return EMAIL.test(s) ? s : null;
};

export async function GET(request: Request) {
  const email = readEmail(new URL(request.url).searchParams.get("email"));
  const online = await activeToday();

  if (!email) {
    return NextResponse.json(
      { ok: true, streak: 0, longest: 0, rep: 0, totalCheckins: 0, checkedInToday: false, online },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const row = await getStreak(email);
  const today = new Date().toISOString().slice(0, 10);

  return NextResponse.json(
    {
      ok: true,
      handle: handleFor(email),
      streak: row?.current_streak ?? 0,
      longest: row?.longest_streak ?? 0,
      rep: row?.rep_earned ?? 0,
      totalCheckins: row?.total_checkins ?? 0,
      checkedInToday: row?.last_checkin === today,
      online,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const email = readEmail(body.email);
  if (!email) {
    return NextResponse.json({ ok: false, message: "Add your email first." }, { status: 400 });
  }

  const result = await checkIn(email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.error ?? result.message }, { status: 502 });
  }

  return NextResponse.json(
    { ...result, handle: handleFor(email), online: await activeToday() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
