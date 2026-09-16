"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, Settings, UserRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLogout } from "@/lib/useLogout";
import { displayName, initials } from "@/lib/displayName";
import { tabHref } from "@/lib/tabs";

/**
 * The avatar in the top-right, now an account menu.
 *
 * The avatar itself is unchanged — same blue badge, same initials from the
 * member's own profile. What it opens is terminal-styled to match the AI Bot
 * tab, and what it shows about the member is only what is actually known:
 * address, membership status and join date. No reputation figure — the one on
 * the sidebar card is a literal shown to every account, and repeating it here
 * would present it as this member's.
 */

const STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: "verified member", tone: "text-[#00ff88] border-[#00ff88]/40" },
  pending: { label: "pending approval", tone: "text-[#facc15] border-[#facc15]/40" },
  rejected: { label: "not approved", tone: "text-[#ff4d4d] border-[#ff4d4d]/40" },
  banned: { label: "restricted", tone: "text-[#ff4d4d] border-[#ff4d4d]/40" },
};

export function UserMenu() {
  const { user, profile, status } = useAuth();
  const { logout, busy, error } = useLogout();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const who = profile ?? (user?.email ? { email: user.email } : null);

  // Close on a click outside or Escape — a menu that only closes from its own
  // button traps keyboard and touch users.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const since = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const s = status ? STATUS[status] : null;

  const item = "flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-[#e5e5e5] transition-colors hover:bg-[#262626]";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={who ? `Account menu — ${displayName(who)}` : "Account menu"}
        title={who ? displayName(who) : undefined}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-blue/30 bg-gradient-to-br from-[#1E4C9E] to-[#0A1931] text-[12px] font-bold text-white transition-shadow duration-200 hover:shadow-glow"
      >
        {who ? initials(who) : "GF"}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[260px] overflow-hidden rounded-lg border border-[#262626] bg-[#141414] shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
        >
          <div className="border-b border-[#262626] px-3.5 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#00ff88]">
              <span className="text-[#00ff88]/50">_&gt;</span> signed in
            </p>
            {who ? <p className="mt-1.5 truncate text-[13px] font-semibold text-[#e5e5e5]">{displayName(who)}</p> : null}
            <p className="truncate font-mono text-[11.5px] text-[#a3a3a3]">{user?.email ?? "—"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {s ? (
                <span className={`rounded border px-1.5 py-px font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] ${s.tone}`}>
                  {s.label}
                </span>
              ) : null}
              {since ? <span className="font-mono text-[10.5px] text-[#525252]">since {since}</span> : null}
            </div>
          </div>

          <div className="py-1">
            <Link role="menuitem" href={tabHref("profile")} onClick={() => setOpen(false)} className={item}>
              <UserRound className="h-3.5 w-3.5 text-[#a3a3a3]" /> Profile
            </Link>
            <Link role="menuitem" href={tabHref("membership")} onClick={() => setOpen(false)} className={item}>
              <BadgeCheck className="h-3.5 w-3.5 text-[#a3a3a3]" /> Membership
            </Link>
            <Link role="menuitem" href={tabHref("settings")} onClick={() => setOpen(false)} className={item}>
              <Settings className="h-3.5 w-3.5 text-[#a3a3a3]" /> Settings
            </Link>
          </div>

          <div className="border-t border-[#262626] py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              disabled={busy}
              className="flex w-full items-center gap-2 px-3.5 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-[#ff4d4d] transition-colors hover:bg-[#262626] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[#ff4d4d]/60">_&gt;</span>}
              {busy ? "Signing out…" : "Logout"}
            </button>
            {error ? <p className="px-3.5 pb-2 font-mono text-[10.5px] leading-relaxed text-[#ff4d4d]">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
