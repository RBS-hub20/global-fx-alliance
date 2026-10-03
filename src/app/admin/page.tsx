import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { adminContext } from "@/lib/adminGate";

export const runtime = "nodejs";
// Reads cookies to decide who is asking, so it can never be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  // Belt and braces with robots.ts: an operations console has no business in a
  // search index even while it is 404ing for everyone else.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * /admin — monitoring, CRM, academy, pixel, deposits, security, settings.
 *
 * Gated on the signed-in address being in GFXA_ADMIN_EMAILS. A visitor who is
 * not an admin gets a 404 rather than a 403: the refusal should not confirm
 * that the route exists, and a 403 tells anyone probing that there is an admin
 * list to get onto.
 *
 * With GFXA_ADMIN_EMAILS unset, nobody is an admin and this is a 404 for
 * everyone — including whoever deployed it. That is the safe default for a
 * console that reads every member's rows with the service-role key, but it does
 * mean the variable has to be set in Vercel before the page will open.
 */
export default async function AdminPage() {
  const ctx = await adminContext();
  if (!ctx) notFound();
  return <AdminConsole email={ctx.user.email ?? "admin"} />;
}
