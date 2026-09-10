import { NextResponse } from "next/server";
import { guard } from "@/lib/adminAuth";
import { review } from "@/lib/adminReview";

export const runtime = "nodejs";

/**
 * Remove or ban a member.
 *
 * Both are the same operation on the row — `status` stops being 'approved', and
 * the gate closes on their next load — with a note recording why.
 *
 *   remove -> 'rejected'   the row goes back to the queue's Rejected tab
 *   ban    -> 'banned'     same, and the address is finished
 *
 * What this deliberately does not do is delete the auth user, which the brief
 * offered as an option. Deleting it takes the profile row with it —
 * `profiles.id references auth.users(id) on delete cascade` — so the audit
 * trail this route exists to write would be erased by the same call that wrote
 * it, and there would be nothing in the Rejected tab to look at afterwards.
 *
 * Deleting also makes re-registration *easier*, not harder: Supabase Auth keeps
 * addresses unique and `profiles.email` is unique too, so a banned address
 * cannot come back through the signup form while both rows still exist. Freeing
 * the address is the one thing that would let a removed member back in.
 */
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  let body: { id?: string; reason?: string; ban?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const reason = (body.reason ?? "").trim();
  const status = body.ban ? "banned" : "rejected";
  const verb = body.ban ? "Banned" : "Removed";

  /*
   * The note is the whole audit trail, so it says what happened even when the
   * admin gave no reason. There is no admin identity to log: access here is a
   * single shared GFXA_ADMIN_TOKEN, and an operator name taken from the request
   * body would be typed by the caller and provable by nothing — a fabricated
   * signature is worse than an honest blank.
   */
  const note = `${verb} by admin — ${new Date().toISOString().slice(0, 10)}${reason ? ` — ${reason}` : ""}`;

  // Rebuilt so `review` sees the note it writes alongside the status.
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ id: body.id, note }),
  });

  return review(forwarded, status);
}
