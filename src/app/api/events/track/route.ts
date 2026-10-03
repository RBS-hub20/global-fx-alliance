import { NextResponse } from "next/server";
import {
  TRACKED_EVENTS, allowedPath, clip, deviceFrom, referrerHost, throttled, visitorHash, writeEvent,
  type TrackedEvent,
} from "@/lib/siteEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The beacon the public pages send.
 *
 * Unauthenticated by necessity — it counts visitors, who by definition have no
 * session. Everything that could make that a liability is handled by refusing
 * to store anything interesting: the event name and the path are both checked
 * against closed allow-lists, every text field is clipped, and the client's own
 * claims about who or where it is are ignored in favour of the request headers.
 *
 * Always answers 204. A visitor must never see an analytics error, and an
 * attacker must not learn from the status code whether the table exists.
 */
export async function POST(request: Request) {
  const no = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  let body: Record<string, unknown>;
  try {
    // sendBeacon posts text/plain; parse the text rather than trusting the type.
    const raw = (await request.text()).slice(0, 2000);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return no;
  }

  const event = String(body.event ?? "") as TrackedEvent;
  if (!TRACKED_EVENTS.includes(event)) return no;

  const path = allowedPath(typeof body.path === "string" ? body.path : undefined);
  if (!path) return no;

  const headers = request.headers;
  // Vercel sets both. The left-most x-forwarded-for entry is the client.
  const ip = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "0.0.0.0";
  const ua = headers.get("user-agent") ?? "";
  const visitor = visitorHash(ip, ua);

  if (throttled(`${visitor}:${event}`)) return no;

  await writeEvent({
    event,
    path,
    visitor,
    // From the edge, not from the page: a client-reported country is a guess.
    country: clip(headers.get("x-vercel-ip-country"), 2),
    device: deviceFrom(ua),
    referrer_host: referrerHost(typeof body.referrer === "string" ? body.referrer : undefined),
    utm_source: clip(body.utm_source, 60),
    utm_medium: clip(body.utm_medium, 60),
    utm_campaign: clip(body.utm_campaign, 80),
    utm_content: clip(body.utm_content, 80),
    start_param: clip(body.start_param, 64),
  });

  return no;
}
