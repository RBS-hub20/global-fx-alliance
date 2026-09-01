/**
 * Trading-session clock, expressed in the community's home timezone (Dubai,
 * UTC+4). Pure functions over an injected `now`, so the same input always gives
 * the same output and the logic is testable without mocking the clock.
 */

export const DUBAI_OFFSET_HOURS = 4;

export type SessionStatus = "ACTIVE" | "UPCOMING" | "CLOSED";

export interface SessionWindow {
  name: string;
  openUTC: number;
  closeUTC: number;
}

/** Windows in UTC hours. Sydney wraps midnight. */
export const SESSION_WINDOWS: SessionWindow[] = [
  { name: "Sydney", openUTC: 22, closeUTC: 7 },
  { name: "Tokyo", openUTC: 0, closeUTC: 9 },
  { name: "London", openUTC: 8, closeUTC: 17 },
  { name: "New York", openUTC: 13, closeUTC: 22 },
];

/** Illustrative community figures — there is no live member positioning feed. */
export const COMMUNITY_SESSION_WR: Record<string, number> = {
  Sydney: 55,
  Tokyo: 62,
  London: 45,
  "New York": 70,
};

export interface SessionState {
  name: string;
  status: SessionStatus;
  openUTC: number;
  closeUTC: number;
  /** Minutes until the next state change. */
  minutesToOpen: number | null;
  minutesToClose: number | null;
  personalWinRate: number | null;
  personalTrades: number;
  communityWinRate: number;
}

export interface SessionInfo {
  nowUTC: Date;
  dubaiClock: string;
  dubaiHour: number;
  sessions: SessionState[];
  active: SessionState[];
  next: SessionState | null;
}

function inWindow(hour: number, open: number, close: number): boolean {
  return open <= close ? hour >= open && hour < close : hour >= open || hour < close;
}

function minutesUntilHour(now: Date, targetHour: number): number {
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  const target = targetHour * 60;
  const diff = target - cur;
  return diff >= 0 ? diff : diff + 24 * 60;
}

export function getCurrentSessionInfo(
  now: Date = new Date(),
  personal: { key: string; winRate: number; trades: number }[] = []
): SessionInfo {
  const hour = now.getUTCHours();

  const sessions: SessionState[] = SESSION_WINDOWS.map((w) => {
    const open = inWindow(hour, w.openUTC, w.closeUTC);
    const toOpen = minutesUntilHour(now, w.openUTC);
    const mine = personal.find((p) => p.key === w.name);

    return {
      name: w.name,
      status: open ? "ACTIVE" : toOpen <= 180 ? "UPCOMING" : "CLOSED",
      openUTC: w.openUTC,
      closeUTC: w.closeUTC,
      minutesToOpen: open ? null : toOpen,
      minutesToClose: open ? minutesUntilHour(now, w.closeUTC) : null,
      personalWinRate: mine ? mine.winRate : null,
      personalTrades: mine ? mine.trades : 0,
      communityWinRate: COMMUNITY_SESSION_WR[w.name] ?? 50,
    };
  });

  const dubai = new Date(now.getTime() + DUBAI_OFFSET_HOURS * 3600_000);
  const dubaiClock = `${String(dubai.getUTCHours()).padStart(2, "0")}:${String(dubai.getUTCMinutes()).padStart(2, "0")}`;

  const upcoming = sessions
    .filter((s) => s.status !== "ACTIVE" && s.minutesToOpen !== null)
    .sort((a, b) => (a.minutesToOpen ?? 0) - (b.minutesToOpen ?? 0));

  return {
    nowUTC: now,
    dubaiClock,
    dubaiHour: dubai.getUTCHours(),
    sessions,
    active: sessions.filter((s) => s.status === "ACTIVE"),
    next: upcoming[0] ?? null,
  };
}

export function humanMinutes(mins: number | null): string {
  if (mins === null) return "";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Time-of-day greeting plus what is actually open, in Dubai terms. */
export function getGreeting(info: SessionInfo): string {
  const h = info.dubaiHour;
  const part = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const open = info.active.map((s) => s.name).join(" and ");
  if (open) {
    const closing = info.active
      .slice()
      .sort((a, b) => (a.minutesToClose ?? 0) - (b.minutesToClose ?? 0))[0];
    return `${part}, Trader — ${open} ${info.active.length > 1 ? "are" : "is"} open, ${closing.name} closes in ${humanMinutes(closing.minutesToClose)}.`;
  }
  return info.next
    ? `${part}, Trader — markets are quiet. ${info.next.name} opens in ${humanMinutes(info.next.minutesToOpen)}.`
    : `${part}, Trader.`;
}
