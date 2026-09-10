"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { firstName } from "@/lib/displayName";

/**
 * Time-of-day greeting, read from the reader's own clock.
 *
 * The header said "Good evening, Trader." unconditionally — a hardcoded string,
 * so it read "Good evening" at one in the afternoon. Everything here comes from
 * the browser: `getHours()` is already local, and the timezone label comes from
 * `Intl`, so a member in Manila and one in Dubai each see their own hour without
 * the server knowing or guessing where they are.
 *
 * Rendered after mount. The server has no access to the visitor's clock, so
 * computing this during render would put one hour in the HTML and another in the
 * browser and trip hydration.
 */

/** 5–11 morning, 12–16 afternoon, 17–4 evening. */
function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Asia/Manila" -> "Manila". Falls back to nothing rather than a wrong city. */
function cityFrom(timeZone: string | undefined): string | null {
  if (!timeZone || !timeZone.includes("/")) return null;
  const last = timeZone.split("/").pop();
  return last ? last.replace(/_/g, " ") : null;
}

export function Greeting({ fallback }: { fallback: string }) {
  const { user, profile } = useAuth();
  const [local, setLocal] = useState<{ part: string; clock: string; city: string | null } | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let zone: string | undefined;
      try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        zone = undefined;
      }
      setLocal({
        part: partOfDay(now.getHours()),
        clock: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        city: cityFrom(zone),
      });
    };
    tick();
    // Enough to cross noon or 5pm without a reload; not a second hand.
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  /*
   * The member's own name, from their own profile row — not from a fixture and
   * not from whoever is signed in elsewhere. Falls back through the address to
   * "Trader", so an account registered before the name field still greets.
   */
  const who = firstName(profile ?? { email: user?.email });

  // Server render and first paint: the existing copy, so nothing shifts.
  if (!local) return <>{fallback}</>;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span>{`${local.part}, ${who}.`}</span>
      <span className="num-mono text-[12px] font-normal text-ink-muted">
        {local.city ? `${local.city} · ${local.clock}` : local.clock}
      </span>
    </span>
  );
}
