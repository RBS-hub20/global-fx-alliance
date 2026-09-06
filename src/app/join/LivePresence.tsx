"use client";

import { useEffect, useState } from "react";

/**
 * Real presence, or nothing.
 *
 * The reference page this was modelled on runs an "Only 9 spots remaining"
 * counter. That number is invented, and an invented number is the one claim on
 * an acquisition page a visitor can never check — it is also the claim that
 * costs the most credibility when someone reloads and sees a different figure.
 * This reports members who actually checked in today, and when that is nobody it
 * says the channel is open rather than manufacturing a crowd.
 */
export function LivePresence() {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/streak?email=")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && typeof j?.online === "number") setOnline(j.online); })
      .catch(() => { /* the badge is decoration, never a blocker */ });
    return () => { alive = false; };
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#00D094]/30 bg-[#00D094]/[0.08] px-3.5 py-1.5 text-[12px] font-semibold text-[#00D094]">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D094] opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D094]" />
      </span>
      {online && online > 0
        ? `${online} ${online === 1 ? "member" : "members"} checked in today`
        : "Open now — free to join"}
    </span>
  );
}
