import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireUser } from "./supabaseServer";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Academy access: a real session, and an approved membership.
 *
 * The gate is profiles.status, not the "2,480 Rep / GFXA PRO" on the sidebar —
 * that number is a fixture rendered identically for every account and grants
 * nothing.
 */
export interface AcademyContext { user: User; db: SupabaseClient }

export async function academyContext(): Promise<AcademyContext | NextResponse> {
  const user = await requireUser();
  if (!user) return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, message: "Server is not configured." }, { status: 503 });

  const { data: profile } = await db.from("profiles").select("status").eq("id", user.id).maybeSingle();
  if (profile?.status !== "approved") {
    return NextResponse.json({ ok: false, message: "Academy is for approved members." }, { status: 403 });
  }
  return { user, db };
}

/** True when the tables are not installed yet, so the panel can fall back quietly. */
export function notInstalled(message: string | undefined): boolean {
  return !!message && /relation .* does not exist|could not find the table/i.test(message);
}
