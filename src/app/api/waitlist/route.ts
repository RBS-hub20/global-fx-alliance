import { NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Waitlist endpoint.
 *
 * Validates and rate-limits, then deliberately stores nothing. There is no
 * database and no third-party processor, so the honest design is to keep the
 * address on the visitor's own device and never take custody of it here. The
 * submission is logged without the address so volume can still be observed.
 *
 * The rate-limit map lives in edge-isolate memory: it is per-instance and
 * short-lived, which is enough to blunt naive scripted abuse, and it is not a
 * substitute for a real limiter.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // crude ceiling on isolate memory
  return recent.length > MAX_PER_WINDOW;
}

function valid(email: unknown): email is string {
  if (typeof email !== "string") return false;
  const v = email.trim();
  return v.length >= 6 && v.length <= 254 && !/\s/.test(v) && /^[^@]+@[^@]+\.[A-Za-z]{2,}$/.test(v);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (limited(ip)) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);

  // Honeypot: a real person never fills a hidden field.
  if (body && typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true, stored: false });
  }

  if (!body || !valid(body.email)) {
    return NextResponse.json(
      { ok: false, message: "That doesn't look like a valid email address." },
      { status: 400 }
    );
  }

  // Volume only — the address itself is never logged or persisted.
  console.log(`[waitlist] signup accepted at ${new Date().toISOString()}`);

  return NextResponse.json({ ok: true, stored: false });
}
