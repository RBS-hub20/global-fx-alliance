"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, ThumbsUp } from "lucide-react";
import { Card, CardHead } from "@/components/ui/Primitives";
import { useAuth } from "@/lib/AuthContext";
import { supabaseBrowser } from "@/lib/supabaseClient";

/**
 * Daily bias poll and member-proposed levels.
 *
 * Every number here is a row in Postgres. There is no seeded "47 traders voted,
 * 62% bullish" — an empty poll says it is empty. A member who votes and watches
 * the total go from 0 to 1 has learned the panel is real; one who votes into a
 * pre-loaded 62% learns the opposite, and only has to notice once.
 *
 * Reads and writes go straight from the browser under the member's own session:
 * the row policies in supabase/analysis_community.sql are the access control, so
 * there is no route in between that could forget to apply them. Tallies come
 * from bias_tally() / level_board(), which return counts and never user ids.
 */

/** The poll's day boundary, matching the table's `session_day` default. */
const utcDay = () => new Date().toISOString().slice(0, 10);

type Bias = "bullish" | "bearish" | "neutral";
const CHOICES: Bias[] = ["bullish", "bearish", "neutral"];

const TONE: Record<Bias, string> = {
  bullish: "text-brand-green border-brand-green/40 bg-brand-green/[0.12]",
  bearish: "text-brand-danger border-brand-danger/40 bg-brand-danger/[0.12]",
  neutral: "text-ink border-white/20 bg-white/[0.06]",
};

interface BoardLevel {
  id: string;
  price: number;
  kind: "support" | "resistance";
  note: string | null;
  author: string;
  votes: number;
  voted: boolean;
}

export function CommunityBias({ pair, decimals }: { pair: string; decimals: number }) {
  const { session } = useAuth();
  const supabase = supabaseBrowser();

  const [tally, setTally] = useState<Record<Bias, number> | null>(null);
  const [mine, setMine] = useState<Bias | null>(null);
  const [levels, setLevels] = useState<BoardLevel[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [newPrice, setNewPrice] = useState("");
  const [newKind, setNewKind] = useState<"support" | "resistance">("resistance");
  const [newNote, setNewNote] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !session) return;
    setErr(null);

    const [t, v, b] = await Promise.all([
      supabase.rpc("bias_tally", { p_pair: pair }),
      // Scoped to today: the policy already limits this to the member's own
      // rows, but they accumulate one per day, and maybeSingle() on a member
      // who voted yesterday too would error rather than return today's.
      supabase.from("analysis_votes").select("bias").eq("pair", pair).eq("session_day", utcDay()).maybeSingle(),
      supabase.rpc("level_board", { p_pair: pair }),
    ]);

    if (t.error) { setErr(missing(t.error.message)); return; }

    const counts: Record<Bias, number> = { bullish: 0, bearish: 0, neutral: 0 };
    for (const row of (t.data ?? []) as { bias: Bias; votes: number }[]) counts[row.bias] = Number(row.votes);
    setTally(counts);
    setMine(((v.data as { bias: Bias } | null)?.bias) ?? null);
    setLevels(b.error ? [] : ((b.data ?? []) as BoardLevel[]).map((l) => ({ ...l, price: Number(l.price) })));
  }, [supabase, session, pair]);

  useEffect(() => { void load(); }, [load]);

  const vote = async (bias: Bias) => {
    if (!supabase || !session) return;
    setBusy(true);
    // One row per member per pair per day; changing your mind updates it.
    const { error } = await supabase
      .from("analysis_votes")
      .upsert({ user_id: session.user.id, pair, bias }, { onConflict: "user_id,pair,session_day" });
    setBusy(false);
    if (error) { setErr(missing(error.message)); return; }
    await load();
  };

  const propose = async () => {
    if (!supabase || !session) return;
    const price = Number(newPrice);
    if (!Number.isFinite(price) || price <= 0) { setErr("Enter a price."); return; }
    setBusy(true);
    const { error } = await supabase.from("analysis_levels").insert({
      user_id: session.user.id, pair, price, kind: newKind, note: newNote.trim().slice(0, 140) || null,
    });
    setBusy(false);
    if (error) {
      setErr(/duplicate key/i.test(error.message) ? "You have already posted that level." : missing(error.message));
      return;
    }
    setNewPrice(""); setNewNote("");
    await load();
  };

  const toggleLevelVote = async (l: BoardLevel) => {
    if (!supabase || !session) return;
    if (l.voted) {
      await supabase.from("analysis_level_votes").delete().eq("level_id", l.id).eq("user_id", session.user.id);
    } else {
      await supabase.from("analysis_level_votes").insert({ level_id: l.id, user_id: session.user.id });
    }
    await load();
  };

  if (!session) {
    return (
      <Card>
        <CardHead title="Community bias" />
        <p className="px-5 pb-5 text-[12.5px] text-ink-muted">Sign in to vote and to post a level.</p>
      </Card>
    );
  }

  const total = tally ? tally.bullish + tally.bearish + tally.neutral : 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ------------------------------------------------------------- poll */}
      <Card>
        <CardHead title={`Bias today — ${pair}`} />
        <div className="space-y-3 p-5">
          <div className="flex gap-2">
            {CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                disabled={busy}
                onClick={() => void vote(c)}
                aria-pressed={mine === c}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold capitalize transition-all disabled:opacity-50 ${
                  mine === c ? TONE[c] : "border-white/[0.08] text-ink-muted hover:text-ink"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {tally === null ? (
            <p className="text-[12px] text-ink-muted">
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> reading the board…
            </p>
          ) : total === 0 ? (
            <p className="text-[12.5px] text-ink-muted">
              No votes yet today. Yours will be the first — the poll resets each UTC day.
            </p>
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="bg-brand-green transition-all duration-500" style={{ width: `${pct(tally.bullish)}%` }} />
                <div className="bg-brand-danger transition-all duration-500" style={{ width: `${pct(tally.bearish)}%` }} />
                <div className="bg-white/25 transition-all duration-500" style={{ width: `${pct(tally.neutral)}%` }} />
              </div>
              <div className="flex justify-between text-[11.5px]">
                <span className="text-brand-green">{pct(tally.bullish)}% bullish</span>
                <span className="text-brand-danger">{pct(tally.bearish)}% bearish</span>
                <span className="text-ink-muted">{pct(tally.neutral)}% neutral</span>
              </div>
              <p className="text-[11.5px] text-ink-muted">
                {total} {total === 1 ? "member has" : "members have"} voted today.
                {mine ? ` You voted ${mine}.` : " You have not voted."}
              </p>
            </>
          )}
        </div>
      </Card>

      {/* ----------------------------------------------------------- levels */}
      <Card>
        <CardHead title="Levels members are watching" />
        <div className="space-y-3 p-5">
          {levels === null ? (
            <p className="text-[12px] text-ink-muted">loading…</p>
          ) : levels.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No levels posted for {pair} yet.</p>
          ) : (
            <ul className="space-y-2">
              {levels.slice(0, 5).map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2">
                  <span className={`num-mono text-[10px] font-bold uppercase ${l.kind === "support" ? "text-brand-green" : "text-brand-danger"}`}>
                    {l.kind === "support" ? "S" : "R"}
                  </span>
                  <span className="num-mono text-[14px] font-semibold text-white">{l.price.toFixed(decimals)}</span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-muted">
                    {l.note ? `${l.note} — ` : ""}{l.author}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleLevelVote(l)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors ${
                      l.voted ? "border-brand-blue/50 bg-brand-blue/[0.14] text-brand-blue" : "border-white/[0.1] text-ink-muted hover:text-ink"
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" strokeWidth={2} />
                    {l.votes}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.06] pt-3">
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as "support" | "resistance")}
              className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-2 py-2 text-[12px] text-ink outline-none"
            >
              <option value="resistance">Resistance</option>
              <option value="support">Support</option>
            </select>
            <input
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              inputMode="decimal"
              placeholder="price"
              className="num-mono w-[110px] rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-blue/50"
            />
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              maxLength={140}
              placeholder="why does it matter?"
              className="min-w-[140px] flex-1 rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-blue/50"
            />
            <button
              type="button"
              disabled={busy || !newPrice}
              onClick={() => void propose()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/40 px-3 py-2 text-[12px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              Post
            </button>
          </div>

          {err ? <p className="text-[11.5px] text-brand-danger">{err}</p> : null}
        </div>
      </Card>
    </div>
  );
}

/** Turns the two Postgres failures this panel can hit into something actionable. */
function missing(message: string): string {
  if (/Could not find the function|does not exist/i.test(message)) {
    return "Community tables not installed yet — run supabase/analysis_community.sql.";
  }
  if (/row-level security|permission denied/i.test(message)) {
    return "Blocked by row-level security — run supabase/analysis_community.sql.";
  }
  return message;
}
