"use client";

import { useCallback, useState } from "react";
import { Loader2, ShieldCheck, UserX } from "lucide-react";
import { Card, CardHead, Modal, PanelHeader, Pills, Skeleton, Toast } from "@/components/ui/Primitives";
import type { MemberStatus } from "@/lib/supabaseClient";
import { displayName } from "@/lib/displayName";

/**
 * Membership review queue.
 *
 * Reads `profiles` through /api/admin/*, which hold the service-role key. The
 * old queue read `verified_users`, the pre-auth table where approval was a flag
 * with no account behind it; approving there no longer grants anyone anything,
 * because the dashboard now asks for a Supabase session and a profile row.
 *
 * The token lives in component state and sessionStorage — never localStorage and
 * never the URL, because this app runs Vercel Analytics and analytics records
 * page URLs.
 */

interface Profile {
  id: string;
  email: string;
  account_number: string;
  server: string | null;
  broker: string;
  status: MemberStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  // Null on rows created before supabase/profiles_add_name_columns.sql.
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const SCOPES = ["pending", "approved", "rejected", "banned", "all"] as const;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[#fbbf24]/[0.13] text-[#fbbf24]",
  approved: "bg-brand-green/[0.13] text-brand-green",
  rejected: "bg-brand-danger/[0.13] text-brand-danger",
  banned: "bg-brand-danger/[0.13] text-brand-danger",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) : "—";

export function AdminPanel() {
  const [token, setToken] = useState(() => {
    try { return window.sessionStorage.getItem("gfxa-admin-token") ?? ""; } catch { return ""; }
  });
  const [scope, setScope] = useState<(typeof SCOPES)[number]>("pending");
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [target, setTarget] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");
  const [ban, setBan] = useState(false);
  const [removing, setRemoving] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const load = useCallback(async (t: string, s: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/pending?status=${s}`, { headers: { "x-admin-token": t } });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(res.status === 401 ? "Invalid token." : j.message ?? "Could not open the queue.");
        setRows(null);
        return;
      }
      setRows(j.profiles as Profile[]);
      try { window.sessionStorage.setItem("gfxa-admin-token", t); } catch { /* private mode */ }
    } catch {
      setErr("Could not reach the queue.");
    } finally {
      setBusy(false);
    }
  }, []);

  const act = async (id: string, action: "approve" | "reject", email: string) => {
    const res = await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ id }),
    });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.ok) {
      flash(`${email} ${action === "approve" ? "approved" : "rejected"}`);
      void load(token, scope);
    } else {
      flash(j?.message ?? "That didn't go through");
    }
  };

  const remove = async () => {
    if (!target) return;
    setRemoving(true);
    const res = await fetch("/api/admin/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ id: target.id, reason: reason.trim(), ban }),
    });
    const j = await res.json().catch(() => null);
    setRemoving(false);
    if (res.ok && j?.ok) {
      flash(`${target.email} ${ban ? "banned" : "removed"}`);
      setTarget(null);
      setReason("");
      setBan(false);
      void load(token, scope);
    } else {
      flash(j?.message ?? "That didn't go through");
    }
  };

  return (
    <div className="space-y-5">
      <PanelHeader title="Membership review" />

      <Card>
        <CardHead title="Open the queue" />
        <form
          onSubmit={(e) => { e.preventDefault(); void load(token, scope); }}
          className="flex flex-wrap items-end gap-3 p-5"
        >
          <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Admin token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="GFXA_ADMIN_TOKEN"
              className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-blue/50"
            />
          </label>
          <button type="submit" disabled={busy || !token} className="btn-primary !py-2.5 text-[12.5px] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Load
          </button>
        </form>
        {err ? <p className="px-5 pb-5 text-[12.5px] text-brand-danger">{err}</p> : null}
      </Card>

      {rows ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-brand-green/30 bg-brand-green/[0.06] px-4 py-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" strokeWidth={2} />
            <p className="text-[12.5px] leading-relaxed text-ink">
              <span className="font-semibold text-white">Reading the profiles table.</span> Approving here
              flips <code className="text-brand-blue">profiles.status</code> with the service-role key, and
              the member&apos;s dashboard opens on their next load — no re-entry of the account number, on
              any device.
            </p>
          </div>

          <Pills
            options={SCOPES.map((s) => s)}
            value={scope}
            onChange={(s) => { setScope(s); void load(token, s); }}
          />

          <Card>
            <CardHead title={`${scope} (${rows.length})`} />
            {rows.length === 0 ? (
              <p className="px-5 pb-5 text-[12.5px] text-ink-muted">Nothing in this queue.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-[12px]">
                  <thead className="text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
                    <tr className="border-b border-white/[0.06]">
                      {["Name", "Email", "Account", "Server", "Broker", "Status", "Applied", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-white/[0.04]">
                        {/* The row's own name — never the signed-in admin's. */}
                        <td className="px-4 py-2.5 font-medium text-white">
                          {displayName(r, "—")}
                          {!r.display_name && !r.first_name ? (
                            <span className="ml-1.5 text-[10px] font-normal uppercase tracking-[0.08em] text-ink-muted/70">from email</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-ink">{r.email}</td>
                        <td className="num-mono px-4 py-2.5 text-ink">{r.account_number}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.server || "—"}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.broker}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[r.status] ?? ""}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="num-mono px-4 py-2.5 text-[11px] text-ink-muted">{when(r.created_at)}</td>
                        <td className="px-4 py-2.5">
                          {r.status === "pending" ? (
                            <span className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void act(r.id, "approve", r.email)}
                                className="rounded border border-brand-green/40 px-2 py-1 text-[11px] text-brand-green transition-colors hover:bg-brand-green/10"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void act(r.id, "reject", r.email)}
                                className="rounded border border-brand-danger/40 px-2 py-1 text-[11px] text-brand-danger transition-colors hover:bg-brand-danger/10"
                              >
                                Reject
                              </button>
                            </span>
                          ) : r.status === "approved" ? (
                            /* Only approved rows: there is no access to take away from the others. */
                            <button
                              type="button"
                              onClick={() => { setTarget(r); setReason(""); setBan(false); }}
                              className="inline-flex items-center gap-1.5 rounded border border-brand-danger/40 px-2 py-1 text-[11px] font-medium text-brand-danger transition-colors hover:bg-brand-danger/10"
                            >
                              <UserX className="h-3 w-3" strokeWidth={2} />
                              Remove
                            </button>
                          ) : (
                            <span className="text-[11px] text-ink-muted" title={r.note ?? undefined}>
                              {when(r.reviewed_at)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : busy ? (
        <Skeleton className="h-40 w-full" />
      ) : null}

      <Modal open={!!target} onClose={() => (removing ? null : setTarget(null))} title={ban ? "Ban this member?" : "Remove this member?"}>
        <p className="text-[13px] leading-relaxed text-ink">
          Remove <span className="font-semibold text-white">{target?.email}</span>? They will lose
          dashboard access and need to re-register.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          They stay signed in but land on the gate instead of the dashboard, and the row moves to the{" "}
          {ban ? "Banned" : "Rejected"} tab with the reason below. Their login is not deleted — that is
          what keeps the address from being registered a second time.
        </p>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. no funded account under the partner link"
            className="rounded-lg border border-white/[0.1] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink outline-none focus:border-brand-blue/50"
          />
        </label>

        <label className="mt-3 flex items-start gap-2.5 text-[12.5px] text-ink">
          <input type="checkbox" checked={ban} onChange={(e) => setBan(e.target.checked)} className="mt-[3px]" />
          <span>
            Ban as well
            <span className="block text-[11.5px] text-ink-muted">
              Same removal, marked <code className="text-brand-danger">banned</code> — the signup form tells
              them the account is restricted instead of that it already exists.
            </span>
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={removing} onClick={() => setTarget(null)} className="btn-ghost !px-4 !py-2 text-[12.5px]">
            Cancel
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={() => void remove()}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-danger/50 bg-brand-danger/[0.12] px-4 py-2 text-[12.5px] font-semibold text-brand-danger transition-colors hover:bg-brand-danger/20 disabled:opacity-50"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" strokeWidth={2} />}
            {removing ? "Removing…" : ban ? "Ban" : "Remove"}
          </button>
        </div>
      </Modal>

      <Toast message={toast} />
    </div>
  );
}
