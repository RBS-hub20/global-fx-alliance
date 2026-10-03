import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps signed-out visitors out of /dashboard.
 *
 * This is a front door, not the lock. Every member's data is already protected
 * where it lives — RLS on each table, a session check in each API route — so a
 * request that got past this still reads nothing it should not. What this adds
 * is that a signed-out visitor gets a login screen instead of a dashboard shell
 * full of empty panels.
 *
 * It also refreshes the session cookie on the way through, which is what keeps
 * a member signed in past the access token's one-hour life.
 */

const LOGIN = "/login";
const SIGNUP = "/signup";

/** Where to send a visitor who has no session. */
function entryFor(request: NextRequest): string {
  /*
   * The landing page's calls to action all point at /dashboard with a ?ref=.
   * Only ref=login (the navbar's "Log in") is a returning member; hero,
   * final-cta, nav, academy and the rest are people who have never signed up,
   * and landing them on a password prompt would lose them. Routed here so the
   * landing page itself does not have to change.
   */
  const ref = request.nextUrl.searchParams.get("ref");
  return ref && ref !== "login" ? SIGNUP : LOGIN;
}

function redirectTo(request: NextRequest, path: string, extra?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Not configured: let it through rather than lock everyone out of a
  // deployment that has no auth to sign in with. The access gate does the same.
  if (!url || !anon) return response;

  // No auth cookie at all is unambiguous, and needs no network round trip.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) return redirectTo(request, entryFor(request));

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser, not getSession: getSession trusts the cookie's JWT without asking
  // the auth server, so a revoked or forged token would pass.
  const { data, error } = await supabase.auth.getUser();

  /*
   * Supabase unreachable is not the same as signed out.
   *
   * Treating an outage as "no user" redirects to /login, whose client sees a
   * valid session and sends the member straight back here — a loop that locks
   * every member out for as long as the outage lasts. Letting the request
   * through is safe for the reason above: the data behind the page is guarded
   * by RLS and the API routes, not by this redirect.
   */
  if (error && (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500)) {
    return response;
  }

  if (!data.user) return redirectTo(request, entryFor(request));

  // Supabase normally refuses sign-in for an unconfirmed address outright; this
  // covers a project where that setting was changed after accounts existed.
  if (!data.user.email_confirmed_at) return redirectTo(request, LOGIN, { verify: "1" });

  return response;
}

export const config = {
  /*
   * The dashboard and the admin console. The landing page, /join, /links, auth
   * pages and API routes are untouched — the API routes authenticate each
   * request themselves.
   *
   * /admin is here so a signed-out admin lands on the login form rather than on
   * the 404 the page itself returns for everyone who is not on the allow-list.
   * The page still makes that decision; this only saves the wasted trip.
   */
  matcher: ["/dashboard", "/dashboard/:path*", "/admin", "/admin/:path*"],
};
