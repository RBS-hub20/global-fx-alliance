"use client";

import { useState } from "react";
import { CARD, Empty, Head, Stat, Table, Td, day, useJson } from "./bits";

interface Pending {
  id: string; email: string; broker: string; account: string; server: string | null;
  method: string; ibCode: string | null; createdAt: number; proofUrl: string | null;
}

interface Payload {
  pending: Pending[];
  stats: { pending: number; verifiedTotal: number; approvedToday: number; allTime: number };
}

const BTN = "rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider disabled:opacity-40";

export function DepositsTab() {
  const { data, error, loading, reload } = useJson<Payload>("/api/admin/deposits", 30_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState<Record<string, string>>({});

  async function act(id: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason for rejection (recorded on the row):") : null;
    if (action === "reject" && reason === null) return;
    setBusy(id);
    try {
      const deposit = Number.parseFloat(amount[id] ?? "");
      await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, action,
          depositUsd: Number.isFinite(deposit) ? deposit : undefined,
          reason: reason ?? undefined,
        }),
      });
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Awaiting review" value={data?.stats.pending ?? 0}
          tone={(data?.stats.pending ?? 0) > 0 ? "warn" : "good"} />
        <Stat label="Approved today" value={data?.stats.approvedToday ?? 0} tone="good" />
        <Stat label="Verified, all time" value={data?.stats.verifiedTotal ?? 0} />
        <Stat label="Submissions, all time" value={data?.stats.allTime ?? 0} tone="dim" />
      </div>

      {error ? <div className={`${CARD} px-4 py-4 font-mono text-[12px] text-[#ef4444]`}>{error}</div> : null}

      <section className={CARD}>
        <Head right={<button onClick={reload} className="font-mono text-[10px] uppercase tracking-wider text-[#737373] hover:text-white">{loading ? "…" : "refresh"}</button>}>
          Broker proofs · pending
        </Head>

        {data && data.pending.length === 0 ? (
          <Empty title="Nothing waiting.">Approvals grant Academy and dashboard access, so the queue is meant to be empty.</Empty>
        ) : null}

        {data && data.pending.length > 0 ? (
          <Table head={["Submitted", "Email", "Broker", "Account", "Server", "How", "Proof", "Deposit USD", ""]}>
            {data.pending.map((r) => (
              <tr key={r.id} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="text-[#737373]">{day(new Date(r.createdAt).toISOString())}</Td>
                <Td className="text-white">{r.email}</Td>
                <Td>{r.broker}</Td>
                <Td>{r.account}</Td>
                <Td className="text-[#737373]">{r.server ?? "—"}</Td>
                <Td className="text-[#737373]">{r.method}</Td>
                <Td>
                  {r.proofUrl ? (
                    <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="text-[#00ff88] hover:underline">
                      open
                    </a>
                  ) : <span className="text-[#737373]">none</span>}
                </Td>
                <Td>
                  <input value={amount[r.id] ?? "" } onChange={(e) => setAmount((a) => ({ ...a, [r.id]: e.target.value }))}
                    placeholder="from IB portal" inputMode="decimal"
                    className="w-28 rounded border border-[#262626] bg-[#0f0f0f] px-2 py-1 font-mono text-[11px] text-[#d4d4d4] outline-none focus:border-[#00ff88]/50" />
                </Td>
                <Td>
                  <span className="flex gap-1.5">
                    <button disabled={busy === r.id} onClick={() => void act(r.id, "approve")}
                      className={`${BTN} border-[#00ff88]/40 text-[#00ff88] hover:bg-[#00ff88]/10`}>
                      {busy === r.id ? "…" : "Approve"}
                    </button>
                    <button disabled={busy === r.id} onClick={() => void act(r.id, "reject")}
                      className={`${BTN} border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10`}>
                      Reject
                    </button>
                  </span>
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}

        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Proof links are signed for five minutes and minted only for the rows on screen — the bucket is private, so a
          copied link stops working rather than circulating. The deposit figure is the one you read in the broker&apos;s
          IB portal, never a number the applicant typed; leaving it blank approves without recording an amount.
        </footer>
      </section>
    </div>
  );
}
