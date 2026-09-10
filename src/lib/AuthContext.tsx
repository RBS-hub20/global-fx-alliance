"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser, type MemberStatus, type Profile } from "./supabaseClient";

/**
 * Session and membership state for the whole app.
 *
 * Supabase persists the session itself and refreshes the access token in the
 * background, so a reload restores the session without a round trip and a second
 * device only needs the email and password again — never the account number,
 * because approval lives on the profile row rather than in that browser.
 *
 * `status` is read from the database on every session change rather than cached
 * in the token, so an admin approving or banning someone takes effect on their
 * next load instead of whenever a JWT happens to expire.
 */

interface AuthState {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  status: MemberStatus | null;
  configured: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  ready: false, session: null, user: null, profile: null, status: null,
  configured: false, refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(
    async (uid: string | undefined) => {
      if (!supabase || !uid) { setProfile(null); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      setProfile((data as Profile | null) ?? null);
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    let alive = true;

    // The stored session, restored before the first paint that depends on it.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      if (alive) setReady(true);
    });

    // Fires on sign-in, sign-out, and every silent token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!alive) return;
      setSession(next);
      await loadProfile(next?.user?.id);
      setReady(true);
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [supabase, loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      status: profile?.status ?? null,
      configured: !!supabase,
      refresh: async () => { await loadProfile(session?.user?.id); },
      signOut: async () => { await supabase?.auth.signOut(); setProfile(null); },
    }),
    [ready, session, profile, supabase, loadProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}
