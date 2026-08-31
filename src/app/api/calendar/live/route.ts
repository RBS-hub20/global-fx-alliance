import { NextResponse } from "next/server";
import { CALENDAR } from "@/lib/data";

export const runtime = "edge";

/**
 * Today's economic calendar.
 *
 * Every free calendar feed worth using needs an API key, so this serves the
 * curated schedule in lib/data — real recurring releases (PCE, ECB speeches,
 * BoJ, PMIs) at their real UTC times — and marks which ones have already
 * printed relative to the current clock. Labelled `curated` so no caller
 * mistakes it for a live feed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currency = (searchParams.get("currency") ?? "all").toUpperCase();
  const importance = (searchParams.get("importance") ?? "all").toLowerCase();

  const now = new Date();
  const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();

  let events = CALENDAR.map((e) => {
    const [h, m] = e.time.split(":").map(Number);
    const released = h * 60 + m <= minutesNow;
    return {
      time: e.time,
      currency: e.currency,
      flag: e.flag,
      event: e.title,
      importance: e.impact.toLowerCase() as "low" | "medium" | "high",
      // Only surface an actual once the scheduled time has passed.
      actual: released ? e.actual || null : null,
      forecast: e.forecast,
      previous: e.previous,
      released,
      detail: e.detail,
      affects: e.affects,
    };
  });

  if (currency !== "ALL") events = events.filter((e) => e.currency === currency);
  if (importance !== "all") events = events.filter((e) => e.importance === importance);

  return NextResponse.json(
    {
      date: now.toISOString().slice(0, 10),
      timezone: "UTC",
      count: events.length,
      highImpact: events.filter((e) => e.importance === "high").length,
      pending: events.filter((e) => !e.released).length,
      events,
      source: "curated",
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
