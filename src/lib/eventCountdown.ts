/**
 * Countdown state for a calendar event.
 *
 * Events carry a wall-clock `HH:MM` in UTC and no date, so the time is read as
 * today in UTC. Pure over an injected `now` — the same input always gives the
 * same answer, which is what makes the boundaries testable and keeps the server
 * and client renders from disagreeing.
 */

export type EventPhase =
  /** Still ahead. */
  | "upcoming"
  /** Ahead, and close enough to matter. */
  | "imminent"
  /** Due, no figure printed yet. */
  | "live"
  /** A figure has printed. */
  | "released"
  /** Due a while ago and still nothing. */
  | "missed";

export interface Countdown {
  phase: EventPhase;
  /** Short label for the badge. */
  label: string;
  /** Signed minutes to the event; negative once it is due. */
  minutesAway: number;
}

/** How close counts as imminent, and how long "live" lasts once due. */
export const IMMINENT_MINUTES = 60;
const LIVE_WINDOW_MINUTES = 60;

/** "9h 11m", "45m", "1d 2h". */
function human(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** Minutes from `now` to `HH:MM` today in UTC. NaN when the time is unparseable. */
export function minutesUntil(time: string, now: Date): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return Number.NaN;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return Number.NaN;
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  return hh * 60 + mm - nowMins;
}

export function countdownFor(time: string, actual: string, now: Date): Countdown {
  const away = minutesUntil(time, now);

  // A printed figure settles it regardless of the clock — a release can land
  // early or late, and the number is the fact, not the schedule.
  if (actual && actual.trim() && actual.trim() !== "—") {
    return { phase: "released", label: "Released", minutesAway: Number.isNaN(away) ? 0 : away };
  }

  if (Number.isNaN(away)) return { phase: "upcoming", label: "—", minutesAway: 0 };

  if (away > 0) {
    return {
      phase: away <= IMMINENT_MINUTES ? "imminent" : "upcoming",
      label: `in ${human(away)}`,
      minutesAway: away,
    };
  }

  if (away > -LIVE_WINDOW_MINUTES) {
    return { phase: "live", label: "Live now", minutesAway: away };
  }

  return { phase: "missed", label: `${human(-away)} ago`, minutesAway: away };
}
