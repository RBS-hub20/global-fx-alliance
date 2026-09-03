"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Camera, Flame, Loader2, NotebookPen, Users } from "lucide-react";
import { Card, Skeleton } from "@/components/ui/Primitives";
import { getMemberEmail, setMemberEmail } from "@/lib/memberIdentity";
import { getBestWorst } from "@/lib/journalStore";
import { tabHref } from "@/lib/tabs";

/**
 * The reason to open the dashboard on a day you were not going to trade.
 *
 * Every number here is measured: rep is what check-ins actually earned, the rank
 * is this member's real position on the board, presence is a count of members who
 * checked in today, and the book figures come from an imported statement. Where
 * there is nothing to show it says so rather than showing a placeholder — an
 * invented streak or a padded "traders online" is the one kind of number nobody
 * can sanity-check.
 */

interface StreakState {
  streak: number;
  longest: number;
  rep: number;
  totalCheckins: number;
  checkedInToday: boolean;
  online: number;
  handle?: string;
}

const signed = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(n).toFixed(2)}`;

export function MyAlliance() {
  const [email, setEmail] = useState("");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<StreakState | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [book, setBook] = useState<ReturnType<typeof getBestWorst> | null>(null);

  const load = useCallback(async (addr: string) => {
    const [s, board, gate] = await Promise.all([
      fetch(`/api/streak?email=${encodeURIComponent(addr)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/streak/leaderboard?limit=100").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      addr
        ? fetch(`/api/ib/status?email=${encodeURIComponent(addr)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null),
    ]);
    if (s?.ok) setState(s as StreakState);
    if (gate) setVerified(!!gate.verified);
    if (s?.handle && Array.isArray(board?.rows)) {
      const i = board.rows.findIndex((r: { handle: string }) => r.handle === s.handle);
      setRank(i >= 0 ? i + 1 : null);
    }
  }, []);

  useEffect(() => {
    const addr = getMemberEmail();
    setEmail(addr);
    setBook(getBestWorst());
    void load(addr);
  }, [load]);

  const doCheckIn = async () => {
    if (!email || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json();
      if (j.ok) {
        setState((prev) => ({ ...(prev ?? { online: 0 }), ...j }));
        setFlash(j.isNewDay ? `${j.message} +${j.repEarned} rep` : j.message);
        void load(email);
      } else {
        setFlash(j.message ?? "Check-in failed.");
      }
    } catch {
      setFlash("Could not reach the server.");
    } finally {
      setBusy(false);
      setTimeout(() => setFlash(null), 3200);
    }
  };

  /* ------------------------------------------------------- no email on file */

  if (!email) {
    return (
      <Card className="p-5">
        <p className="text-[13px] font-semibold text-white">Start your streak</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
          Add the email you use with the Alliance. It stays on this device and links your check-ins to
          your verification.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const addr = draft.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) { setFlash("That email doesn't look right."); return; }
            setMemberEmail(addr);
            setEmail(addr);
            void load(addr);
          }}
          className="mt-4 flex flex-wrap gap-2"
        >
          <input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="you@example.com"
            className="min-w-[200px] flex-1 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-blue/50"
          />
          <button type="submit" className="btn-primary !py-2 text-[12.5px]">Save</button>
        </form>
        {flash ? <p className="mt-2 text-[12px] text-[#fbbf24]">{flash}</p> : null}
      </Card>
    );
  }

  const streak = state?.streak ?? 0;
  const toBadge = streak % 7 === 0 && streak > 0 ? 7 : 7 - (streak % 7);
  const progress = Math.min(((streak % 7) / 7) * 100, 100);

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-brand-blue/[0.14] via-brand-blue/[0.06] to-transparent px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white">My Alliance</span>
          {verified === null ? null : verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/[0.13] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-green">
              <BadgeCheck className="h-3 w-3" strokeWidth={2.4} /> Verified member
            </span>
          ) : (
            <Link href={tabHref("chart-snap")} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-white">
              Not verified
            </Link>
          )}
          {state?.handle ? <span className="num-mono text-[11px] text-ink-muted">{state.handle}</span> : null}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
            <Users className="h-3.5 w-3.5" strokeWidth={1.9} />
            {state ? (state.online > 0 ? `${state.online} checked in today` : "Quiet so far today") : <Skeleton className="h-3 w-20" />}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-4">
        <Stat label="Streak" value={state ? `${streak}` : null} icon={<Flame className="h-3.5 w-3.5 text-[#fbbf24]" strokeWidth={2.2} />} suffix={streak === 1 ? "day" : "days"} />
        <Stat label="Rep earned" value={state ? state.rep.toLocaleString() : null} />
        <Stat label="Rank" value={state ? (rank ? `#${rank}` : "unranked") : null} />
        <Stat
          label={book?.isReal ? "Your book" : "Sample book"}
          value={book ? signed(book.summary.netPL) : null}
          tone={book && book.summary.netPL < 0 ? "down" : "up"}
        />
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-[11px] text-ink-muted">
          <span>{streak % 7 === 0 && streak > 0 ? "7-day badge earned" : `${toBadge} to the 7-day badge`}</span>
          <span className="num-mono">{streak % 7}/7</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-brand-green transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-5 py-4">
        <button
          type="button"
          onClick={doCheckIn}
          disabled={busy || !!state?.checkedInToday}
          className="btn-primary !py-2 text-[12.5px] disabled:opacity-45"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />}
          {state?.checkedInToday ? "Checked in today" : "Check in — +10 rep"}
        </button>
        <Link href={tabHref("chart-snap")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] text-ink transition-colors hover:border-brand-blue/40 hover:text-white">
          <Camera className="h-3.5 w-3.5" strokeWidth={1.9} /> Snap a chart
        </Link>
        <Link href={tabHref("journal")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] text-ink transition-colors hover:border-brand-blue/40 hover:text-white">
          <NotebookPen className="h-3.5 w-3.5" strokeWidth={1.9} /> Journal
        </Link>
        {flash ? <span className="self-center text-[12px] text-brand-green">{flash}</span> : null}
      </div>
    </Card>
  );
}

function Stat({
  label, value, icon, suffix, tone,
}: {
  label: string; value: string | null; icon?: React.ReactNode; suffix?: string; tone?: "up" | "down";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">{label}</span>
      {value === null ? (
        <Skeleton className="h-4 w-14" />
      ) : (
        <span className={`num-mono flex items-center gap-1.5 text-[17px] font-semibold ${tone === "down" ? "text-brand-danger" : "text-white"}`}>
          {icon}
          {value}
          {suffix ? <span className="text-[11px] font-normal text-ink-muted">{suffix}</span> : null}
        </span>
      )}
    </div>
  );
}
