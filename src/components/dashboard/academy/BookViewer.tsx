"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Page viewer for the Academy books.
 *
 * Each page is fetched as a 60-second signed URL, drawn into a canvas and
 * overlaid with the reader's own email and membership, repeated diagonally.
 *
 * Worth being straight about what this does: it raises the cost of casual
 * copying — no image element to drag, no menu to "save as", no file to share —
 * and it makes any leak attributable, because the reader's address is burned
 * across every page and every view is logged. It cannot stop a determined
 * person: the bytes reach the browser to be displayed at all, and a phone
 * camera defeats every web defence there is. The watermark is the real control.
 */

interface PageResponse { ok: boolean; type?: "image" | "text"; url?: string; body?: string; message?: string }

export function BookViewer({
  lessonId, title, bookTitle, pages, startPage, onClose, onProgress,
}: {
  lessonId: string;
  title: string;
  bookTitle: string;
  pages: number;
  startPage: number;
  onClose: () => void;
  onProgress: (summary: { done: number; total: number; percent: number }) => void;
}) {
  const { user, profile } = useAuth();
  const [page, setPage] = useState(Math.min(Math.max(startPage, 1), Math.max(pages, 1)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const stamp = [
    user?.email ?? "member",
    profile?.account_number ? `#${profile.account_number}` : "",
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean).join("  ·  ");

  /* --------------------------------------------------------------- render */

  const draw = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap the backing store so a big scan does not blow memory on a phone.
    const maxW = Math.min(img.naturalWidth, 1600);
    const scale = maxW / img.naturalWidth;
    canvas.width = maxW;
    canvas.height = Math.round(img.naturalHeight * scale);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Diagonal, repeating, low contrast — readable enough to identify a leak,
    // faint enough to read the page through.
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.max(16, Math.round(canvas.width / 46))}px ui-monospace, monospace`;
    ctx.rotate((-30 * Math.PI) / 180);
    const step = Math.max(140, Math.round(canvas.width / 7));
    for (let y = -canvas.height; y < canvas.height * 1.6; y += step) {
      for (let x = -canvas.width; x < canvas.width * 1.6; x += ctx.measureText(stamp).width + 80) {
        ctx.fillText(stamp, x, y);
      }
    }
    ctx.restore();
  }, [stamp]);

  /* ---------------------------------------------------------------- fetch */

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setText(null);

    (async () => {
      try {
        const res = await fetch(`/api/academy/page?lesson=${encodeURIComponent(lessonId)}&page=${page}`, { cache: "no-store" });
        const j = (await res.json()) as PageResponse;
        if (!alive) return;
        if (!res.ok || !j.ok) { setError(j.message ?? "Could not open that page."); setLoading(false); return; }

        if (j.type === "text") { setText(j.body ?? ""); setLoading(false); return; }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { if (alive) { draw(img); setLoading(false); } };
        img.onerror = () => { if (alive) { setError("That page did not load. It may have expired — try again."); setLoading(false); } };
        img.src = j.url ?? "";
      } catch {
        if (alive) { setError("Could not reach the library."); setLoading(false); }
      }
    })();

    // Record the page as read, and let the panel update its headline figure.
    void fetch("/api/academy/progress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId, page }),
    }).then((r) => r.json()).then((j) => { if (j?.ok && j.summary) onProgress(j.summary); }).catch(() => {});

    return () => { alive = false; };
  }, [lessonId, page, draw, onProgress]);

  /* ------------------------------------------------------------ deterrents */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, pages));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 1));
      // Save / print / view-source. A speed bump, not a lock.
      if ((e.ctrlKey || e.metaKey) && ["s", "p", "u"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    // Blur the page when the tab loses focus, which is when screenshot tools run.
    const onVisibility = () => {
      const el = shellRef.current;
      if (el) el.style.filter = document.visibilityState === "hidden" ? "blur(18px)" : "";
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, pages]);

  const markComplete = async () => {
    setSaving(true);
    const res = await fetch("/api/academy/progress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson_id: lessonId, page, complete: true }),
    });
    const j = await res.json().catch(() => null);
    setSaving(false);
    if (j?.ok) { setComplete(true); if (j.summary) onProgress(j.summary); }
  };

  const atEnd = page >= pages;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0a0a0a]">
      <header className="flex items-center gap-3 border-b border-[#262626] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#00ff88]">
            <span className="text-[#00ff88]/50">_&gt;</span> {bookTitle}
          </p>
          <h2 className="truncate text-[14px] font-semibold text-[#e5e5e5]">{title}</h2>
        </div>
        <span className="num-mono shrink-0 text-[12px] text-[#a3a3a3]">{page} / {pages}</span>
        <button type="button" onClick={onClose} aria-label="Close reader"
          className="rounded border border-[#262626] p-1.5 text-[#a3a3a3] transition-colors hover:text-[#e5e5e5]">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="h-1 w-full bg-[#141414]">
        <div className="h-full bg-[#00ff88] transition-all duration-300" style={{ width: `${(page / Math.max(pages, 1)) * 100}%` }} />
      </div>

      <div
        ref={shellRef}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        className="flex-1 select-none overflow-auto p-4 transition-[filter] duration-200"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-[#a3a3a3]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="mx-auto max-w-[460px] rounded-lg border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 px-4 py-3 font-mono text-[12px] text-[#ff4d4d]">
            {error}
          </div>
        ) : text !== null ? (
          <article className="relative mx-auto max-w-[70ch] whitespace-pre-wrap text-[14px] leading-relaxed text-[#e5e5e5]">
            {text}
            <span aria-hidden className="pointer-events-none absolute inset-0 select-none overflow-hidden text-[11px] font-mono leading-[3.2] text-white/[0.07]"
              style={{ transform: "rotate(-30deg)", whiteSpace: "pre-wrap" }}>
              {Array.from({ length: 24 }, () => `${stamp}   `).join("")}
            </span>
          </article>
        ) : (
          <canvas ref={canvasRef} className="mx-auto block h-auto w-full max-w-[900px] rounded-lg" />
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-[#262626] px-4 py-3">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#262626] px-3 py-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-[#a3a3a3] transition-colors hover:text-[#e5e5e5] disabled:opacity-40">
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>

        <p className="flex-1 truncate text-center font-mono text-[10px] text-[#525252]">
          Watermarked to {user?.email ?? "you"} · reading only
        </p>

        {atEnd ? (
          <button type="button" onClick={() => void markComplete()} disabled={saving || complete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00ff88] px-3.5 py-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all hover:brightness-110 disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
            {complete ? "Completed" : "Mark complete"}
          </button>
        ) : (
          <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00ff88] px-3.5 py-2 font-mono text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#0a0a0a] transition-all hover:brightness-110">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </footer>
    </div>
  );
}
