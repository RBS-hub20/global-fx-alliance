import { NextResponse } from "next/server";

/** Header the admin panel sends. Never a query string — Vercel Analytics logs URLs. */
export const ADMIN_HEADER = "x-admin-token";

/** Constant-time compare against GFXA_ADMIN_TOKEN. */
export function isAdmin(request: Request): boolean {
  const expected = process.env.GFXA_ADMIN_TOKEN;
  if (!expected) return false;
  const got = request.headers.get(ADMIN_HEADER);
  if (!got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function guard(request: Request): NextResponse | null {
  if (!process.env.GFXA_ADMIN_TOKEN) {
    return NextResponse.json({ ok: false, message: "Queue closed — GFXA_ADMIN_TOKEN is not set." }, { status: 503 });
  }
  if (!isAdmin(request)) return NextResponse.json({ ok: false, message: "Invalid token." }, { status: 401 });
  return null;
}
