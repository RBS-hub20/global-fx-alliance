"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card, CardHead, Pills, Skeleton } from "@/components/ui/Primitives";

/**
 * Streak and rep board.
 *
 * Handles only — the board is derived from real check-ins and shows nobody's
 * address. Positions are earned by turning up, which is the behaviour the board
 * is meant to encourage; with no accounts yet, anyone could check in under an
 * address that is not theirs, so it is presented as a habit tracker rather than
 * a contest with anything at stake.
 */

interface Row {
  handle: string;
  currentStreak: number;
  longestStreak: number;
  rep: number;
  totalCheckins: number;
  checkedInToday: boolean;
}

const SORTS = [
  { label: "Streak", value: "current_streak" },
  { label: "Rep", value: "rep_earned" },
  { label: "Longest", value: "longest_streak" },
] as const;

const MEDAL = ["🥇", "🥈", "🥉"];

export function StreakBoard({ limit = 10 }: { limit?: number }) {
  const [sort, setSort] = useState<string>("current_streak");
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async (s: string) => {
    setRows(null);
    try {
      const r = await fetch(`/api/streak/leaderboard?limit=${limit}&sort=${s}`);
      const j = r.ok ? await r.json() : null;
      setRows(Array.isArray(j?.rows) ? (j.rows as Row[]) : []);
    } catch {
      setRows([]);
    }
  }, [limit]);

  useEffect(() => { void load(sort); }, [sort, load]);

  return (
    <Card>
      <CardHead
        title="Leaderboard"
        icon={Trophy}
        right={
          <Pills
            options={SORTS.map((s) => s.label)}
            value={SORTS.find((s) => s.value === sort)?.label ?? "Streak"}
            onChange={(label) => setSort(SORTS.find((s) => s.label === label)?.value ?? "current_streak")}
          />
        }
      />

      {rows === null ? (
        <div className="space-y-2 p-5"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-4/6" /></div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-[12.5px] leading-relaxed text-ink-muted">
          No check-ins yet. The board fills as members start turning up daily.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((r, i) => (
            <li key={r.handle} className="flex items-center gap-3 px-5 py-2.5 text-[12.5px]">
              <span className="w-8 shrink-0 text-ink-muted">{MEDAL[i] ?? `#${i + 1}`}</span>
              <span className="num-mono min-w-0 flex-1 truncate text-ink">{r.handle}</span>
              {r.checkedInToday ? (
                <span className="hidden shrink-0 rounded-full bg-brand-green/[0.12] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-green sm:inline">
                  today
                </span>
              ) : null}
              <span className="num-mono w-14 shrink-0 text-right text-white">{r.currentStreak}d</span>
              <span className="num-mono w-16 shrink-0 text-right text-ink-muted">{r.rep.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-white/[0.06] px-5 py-3 text-[10.5px] leading-relaxed text-ink-muted/70">
        Handles are derived from your email — the board never publishes addresses. Positions come from
        real check-ins.
      </p>
    </Card>
  );
}
