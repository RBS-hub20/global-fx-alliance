"use client";

import { useCallback, useState } from "react";
import { useAuth } from "./AuthContext";

/**
 * The one logout both the header menu and the sidebar call, so they cannot
 * drift into signing out differently.
 *
 * A hard navigation rather than router.push: the dashboard holds Realtime
 * channels authenticated with the old token and in-memory copies of the
 * member's trades and linked accounts. A full page load closes the sockets and
 * drops all of it; a client-side route change would keep them alive behind the
 * login screen.
 */
export function useLogout() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await signOut();
    if (err) {
      setBusy(false);
      setError(`Could not sign out: ${err}`);
      return;
    }
    window.location.replace("/login?signed_out=1");
  }, [signOut]);

  return { logout, busy, error };
}
