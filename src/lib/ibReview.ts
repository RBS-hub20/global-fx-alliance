import { NextResponse } from "next/server";
import { isAdmin, updateStatus } from "./ibStore";

/**
 * Shared approve/reject handler.
 *
 * Lives here rather than in a route file: Next only permits its own known
 * exports from `route.ts`, so the `/approve` and `/reject` aliases could not
 * import a helper out of the sibling route without tripping that check.
 */

/** Approve or reject in one call; `/approve` and `/reject` delegate here. */
function deny() {
  return NextResponse.json({ ok: false, message: "Invalid token." }, { status: 401 });
}

function closed() {
  return NextResponse.json(
    { ok: false, configured: false, message: "Queue closed — GFXA_ADMIN_TOKEN is not set." },
    { status: 503 }
  );
}

export async function reviewFrom(request: Request, forced?: "approve" | "reject") {
  if (!process.env.GFXA_ADMIN_TOKEN) return closed();
  if (!isAdmin(request)) return deny();

  let body: { id?: string; action?: string; depositUsd?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const action = forced ?? body.action;
  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ ok: false, message: "Need an id and approve or reject." }, { status: 400 });
  }

  const { data, error } = await updateStatus(id, action === "approve" ? "verified" : "rejected", {
    // The figure comes from what the admin read in the IB portal; left null
    // rather than invented when they did not enter one.
    depositUsd: typeof body.depositUsd === "number" && body.depositUsd >= 0 ? body.depositUsd : null,
    reason: action === "reject" ? (body.reason ?? "").trim().slice(0, 300) || null : null,
  });

  if (error) return NextResponse.json({ ok: false, message: error }, { status: 502 });
  if (!data) return NextResponse.json({ ok: false, message: "No such request." }, { status: 404 });

  return NextResponse.json(
    { ok: true, success: true, verified: data.status === "verified", request: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}

