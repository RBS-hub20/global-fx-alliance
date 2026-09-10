import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * The signed-in member, read from the request's cookies inside a route handler.
 *
 * The browser client is `createBrowserClient` from @supabase/ssr, which keeps
 * the session in a cookie as well as localStorage — that cookie is what makes
 * this possible. `getUser()` and not `getSession()`: getSession trusts the JWT
 * in the cookie without asking anyone, and these routes act on live money.
 */
export function supabaseRoute(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const store = cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      // Route handlers may not always be allowed to set cookies; a refresh that
      // cannot be persisted should not crash the request.
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ }
      },
    },
  });
}

export async function requireUser(): Promise<User | null> {
  const db = supabaseRoute();
  if (!db) return null;
  const { data, error } = await db.auth.getUser();
  return error ? null : data.user;
}
