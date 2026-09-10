"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

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

/**
 * A display name from the account.
 *
 * Only used when the local part of the address looks like a name — a single
 * word of letters. "afhomesresort2027" or "renzsom2022" is a handle, not a
 * first name, and "Good morning, Afhomesresort2027" is worse than "Trader".
 */
function nameFrom(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._-]/)[0] ?? "";
  if (!/^[a-z]{2,14}$/i.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function Greeting({ fallback }: { fallback: string }) {
  const { user } = useAuth();
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

  const who = nameFrom(user?.email) ?? "Trader";

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
