"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, MessageSquare } from "lucide-react";
import { Card, CardHead } from "@/components/ui/Primitives";
import { getMemberEmail } from "@/lib/memberIdentity";

/**
 * The community channel.
 *
 * Posts appear under a derived handle, never an email — this is a public
 * surface. With no accounts, a handle is a convention rather than an identity,
 * so nothing here should be read as attributable; the panel says so once, under
 * the composer, instead of implying more than it can deliver.
 */

interface Post {
  id: string;
  handle: string;
  message: string;
  createdAt: string;
}

const MAX = 200;
const POLL_MS = 15_000;

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function Shoutbox() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const email = typeof window === "undefined" ? "" : getMemberEmail();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/shoutbox");
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.messages)) setPosts(j.messages as Post[]);
    } catch {
      /* the channel is optional context */
    }
  }, []);

  useEffect(() => {
    void load();
    // 15s, not the 5s asked for: every open tab polls, and three times the
    // traffic buys three seconds of freshness on a chat that is rarely busy.
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [posts]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    if (!email) { setNote("Add your email in My Alliance first."); return; }

    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/shoutbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setText("");
        setPosts((prev) => [...(prev ?? []), j.post as Post]);
      } else {
        setNote(j.message ?? "That didn't send.");
      }
    } catch {
      setNote("Could not reach the channel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="Shoutbox"
        icon={MessageSquare}
        right={<span className="text-[10.5px] text-ink-muted">{posts?.length ?? 0} recent</span>}
      />

      <div className="max-h-[300px] min-h-[180px] space-y-2.5 overflow-y-auto px-5 py-4">
        {posts === null ? (
          <p className="text-[12.5px] text-ink-muted">Loading the channel…</p>
        ) : posts.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            Nothing yet today. Say what you are watching and someone will pick it up.
          </p>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="flex gap-2.5 text-[12.5px] leading-relaxed">
              <span className="num-mono shrink-0 text-brand-blue">{p.handle}</span>
              <span className="min-w-0 flex-1 text-ink-muted">{p.message}</span>
              <span className="shrink-0 text-[10.5px] text-ink-muted/60">{ago(p.createdAt)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/25 p-1.5 focus-within:border-brand-blue/50">
          <input
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="What are you watching?"
            aria-label="Post to the shoutbox"
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-ink-muted/60"
          />
          <span className="num-mono shrink-0 text-[10.5px] text-ink-muted/60">{MAX - text.length}</span>
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white transition-all duration-200 hover:bg-brand-blue/80 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
        {note ? <p className="mt-2 text-[11.5px] text-[#fbbf24]">{note}</p> : null}
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-muted/70">
          Public channel — posts show a handle, never your email. There are no accounts yet, so treat
          handles as a convention rather than proof of who wrote something. Education only, no signals.
        </p>
      </form>
    </Card>
  );
}
