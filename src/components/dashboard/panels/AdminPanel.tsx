"use client";

import { useCallback, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card, CardHead, PanelHeader, Skeleton, Toast } from "@/components/ui/Primitives";
import type { VerificationRequest } from "@/lib/ibStore";

/**
 * Deposit-verification queue.
 *
 * The token is held in component state only — never localStorage — so it does
 * not sit in the browser for anything else on the origin to read. The server
 * compares it against `GFXA_ADMIN_TOKEN`; nothing here decides access on its own.
 */

type Row = Omit<VerificationRequest, "proofPath"> & { proofUrl: string | null };

interface Payload {
  ok: boolean;
  durable: boolean;
  backend: string;
  requests: Row[];
  stats: {
    pending: number; verified: number; rejected: number;
    byBroker: Record<string, { pending: number; verified: number; rejected: number }>;
    depositsUsd: number;
  };
}

export function AdminPanel() {
  // sessionStorage, not localStorage and never the URL: this app runs Vercel
  // Analytics, which records page URLs, so a token in a query string would be
  // copied into analytics, history and referrers. Session scope clears with the tab.
  const [token, setToken] = useState(() => {
    try { return window.sessionStorage.getItem("gfxa-admin-token") ?? ""; } catch { return ""; }
  });
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1900); };

  const load = useCallback(async (t: string) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/ib/admin", { headers: { "x-admin-token": t } });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErr(res.status === 401 ? "Invalid token." : j.message ?? "Could not open the queue.");
        setData(null);
        return;
      }
      setData(j as Payload);
      try { window.sessionStorage.setItem("gfxa-admin-token", t); } catch { /* private mode */ }
    } catch {
      setErr("Could not reach the queue.");
    } finally {
      setBusy(false);
    }
  }, []);

  const act = async (id: string, action: "approve" | "reject", depositUsd?: number, reason?: string) => {
    const res = await fetch(`/api/ib/admin/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ id, depositUsd, reason }),
    });
    if (res.ok) { flash(action === "approve" ? "Approved" : "Rejected"); void load(token); }
    else flash("That didn't go through");
  };

  const brokerLine = (b: string, v: { pending: number; verified: number; rejected: number }) =>
    `${b}: ${v.pending} pending · ${v.verified} verified${v.rejected ? ` · ${v.rejected} rejected` : ""}`;

  const csv = () => {
    if (!data) return;
    const rows = [
      ["email", "broker", "account", "server", "ibCode", "method", "status", "depositUsd", "createdAt"].join(","),
      ...data.requests.map((r) =>
        [r.email, r.broker, r.account, r.server ?? "", r.ibCode ?? "", r.method, r.status, r.depositUsd ?? "", new Date(r.createdAt).toISOString()]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "gfxa-ib-verifications.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PanelHeader title="Deposit verification" />

      <Card>
        <CardHead title="Open the queue" />
        <form
          onSubmit={(e) => { e.preventDefault(); void load(token); }}
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
          {data ? (
            <button type="button" onClick={csv} className="rounded-lg border border-white/[0.1] px-3 py-2.5 text-[12px] text-ink-muted transition-colors hover:text-white">
              Export CSV
            </button>
          ) : null}
        </form>
        {err ? <p className="px-5 pb-5 text-[12.5px] text-brand-danger">{err}</p> : null}
      </Card>

      {data ? (
        <div className="flex items-start gap-3 rounded-xl border border-brand-green/30 bg-brand-green/[0.06] px-4 py-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" strokeWidth={2} />
          <p className="text-[12.5px] leading-relaxed text-ink">
            <span className="font-semibold text-white">Supabase connected.</span> The queue reads and
            writes the <code className="text-brand-blue">verified_users</code> table, so it survives a
            cold start and a redeploy — not the warm-instance luck the in-memory store depended on.
          </p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Pending", data.stats.pending],
              ["Verified", data.stats.verified],
              ["Rejected", data.stats.rejected],
              ["Confirmed deposits", `$${data.stats.depositsUsd.toFixed(0)}`],
            ].map(([k, v]) => (
              <Card key={String(k)} className="p-4">
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">{k}</p>
                <p className="num-mono mt-1 text-[19px] font-semibold text-white">{v}</p>
              </Card>
            ))}
          </div>

          {Object.keys(data.stats.byBroker).length ? (
            <p className="text-[11.5px] text-ink-muted">
              {Object.entries(data.stats.byBroker).map(([b, v]) => brokerLine(b, v)).join("  ·  ")}
            </p>
          ) : null}

          <Card>
            <CardHead title={`Requests (${data.requests.length})`} />
            {data.requests.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[12px]">
                  <thead className="text-[10.5px] uppercase tracking-[0.08em] text-ink-muted">
                    <tr className="border-b border-white/[0.06]">
                      {["Email", "Broker", "Account", "IB code", "Method", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.map((r) => (
                      <tr key={r.id} className="border-b border-white/[0.04]">
                        <td className="px-4 py-2.5 text-ink">{r.email}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.broker}</td>
                        <td className="num-mono px-4 py-2.5 text-ink">{r.account}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.ibCode ?? "—"}</td>
                        <td className="px-4 py-2.5 text-ink-muted">
                          {r.method}
                          {r.proofUrl ? (
                            <>
                              {" · "}
                              <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline-offset-2 hover:underline">
                                proof
                              </a>
                            </>
                          ) : r.hasProof ? " + proof" : ""}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                            r.status === "verified" ? "bg-brand-green/[0.13] text-brand-green"
                            : r.status === "rejected" ? "bg-brand-danger/[0.13] text-brand-danger"
                            : "bg-[#fbbf24]/[0.13] text-[#fbbf24]"
                          }`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.status === "pending" ? (
                            <span className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = window.prompt("Deposit confirmed in the IB portal (USD). Leave blank if you did not read a figure.");
                                  const n = raw === null ? undefined : Number.parseFloat(raw);
                                  void act(r.id, "approve", Number.isFinite(n as number) ? (n as number) : undefined);
                                }}
                                className="rounded border border-brand-green/40 px-2 py-1 text-[11px] text-brand-green transition-colors hover:bg-brand-green/10"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const reason = window.prompt("Reason for rejecting (shown to nobody but the queue):") ?? "";
                                  void act(r.id, "reject", undefined, reason);
                                }}
                                className="rounded border border-brand-danger/40 px-2 py-1 text-[11px] text-brand-danger transition-colors hover:bg-brand-danger/10"
                              >
                                Reject
                              </button>
                            </span>
                          ) : (
                            <span className="text-ink-muted">{r.depositUsd !== null ? `$${r.depositUsd}` : "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 pb-5 text-[12.5px] text-ink-muted">Nothing in the queue.</p>
            )}
          </Card>
        </>
      ) : busy ? (
        <Skeleton className="h-40 w-full" />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
