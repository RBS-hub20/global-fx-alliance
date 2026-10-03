"use client";

import { CARD, Empty, Head, Pill, Stat, Table, Td, useJson } from "./bits";

interface Payload {
  security: {
    rls: { table: string; verdict: string; detail: string }[];
    anonInsert: { verdict: string; detail: string };
    buckets: { id: string; verdict: string; detail: string }[];
    guards: { path: string; expect: number; status?: number; verdict: string; detail: string }[];
    publicEnvLeaks: string[];
    commit: string | null;
    commitMessage: string | null;
    bundles: { route: string; firstLoadKb: number }[];
    bundlesMeasuredAt: string;
  };
  settings: {
    env: { key: string; set: boolean; need: boolean; why: string }[];
    pixelId: string;
    pixelOverridden: boolean;
    memberClaims: { where: string; shown: string; note: string }[];
    claimsAgree: boolean;
    actual: { accounts: number; approved: number };
  };
}

const tone = (verdict: string): "good" | "warn" | "bad" | "dim" =>
  verdict === "locked" || verdict === "private" || verdict === "ok" ? "good"
    : verdict === "LEAK" || verdict === "PUBLIC" || verdict === "UNEXPECTED" ? "bad"
    : verdict === "inconclusive" || verdict === "unreachable" ? "warn" : "dim";

export function useHealth() {
  return useJson<Payload>("/api/admin/health");
}

export function SecurityTab() {
  const { data, error, loading } = useHealth();

  if (loading && !data) return <div className={`${CARD} px-4 py-8 text-center font-mono text-[12px] text-[#737373]`}>Probing…</div>;
  if (error) return <div className={`${CARD} px-4 py-6 font-mono text-[12px] text-[#ef4444]`}>{error}</div>;
  if (!data) return null;
  const s = data.security;

  const leaks = s.rls.filter((r) => r.verdict === "LEAK").length;
  const publicBuckets = s.buckets.filter((b) => b.verdict === "PUBLIC").length;
  const badGuards = s.guards.filter((g) => g.verdict === "UNEXPECTED").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tables anon can read" value={leaks} sub={`${s.rls.length} checked with the anon key`}
          tone={leaks ? "bad" : "good"} />
        <Stat label="Public buckets" value={publicBuckets} sub="should be none" tone={publicBuckets ? "bad" : "good"} />
        <Stat label="Guards answering wrong" value={badGuards} sub={`${s.guards.length} endpoints probed anonymously`}
          tone={badGuards ? "bad" : "good"} />
        <Stat label="Secrets in NEXT_PUBLIC_" value={s.publicEnvLeaks.length}
          sub={s.publicEnvLeaks.length ? s.publicEnvLeaks.join(", ") : "none"} tone={s.publicEnvLeaks.length ? "bad" : "good"} />
      </div>

      <section className={CARD}>
        <Head right={<Pill tone="dim">asked with the anon key, just now</Pill>}>Row-level security</Head>
        <Table head={["Table", "Verdict", "Detail"]}>
          {s.rls.map((r) => (
            <tr key={r.table} className="border-b border-[#1c1c1c] last:border-0">
              <Td className="text-white">{r.table}</Td>
              <Td><Pill tone={tone(r.verdict)}>{r.verdict}</Pill></Td>
              <Td className="text-[#737373]">{r.detail}</Td>
            </tr>
          ))}
          <tr className="border-t border-[#262626]">
            <Td className="text-white">anon insert</Td>
            <Td><Pill tone={tone(s.anonInsert.verdict)}>{s.anonInsert.verdict}</Pill></Td>
            <Td className="text-[#737373]">{s.anonInsert.detail}</Td>
          </tr>
        </Table>
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          &ldquo;Locked&rdquo; means a real query with the public anon key came back empty or refused. The write probe uses a
          broker value the table&apos;s own check constraint rejects, so it cannot leave a row behind — which is also why a
          refusal other than 42501 reads as inconclusive rather than as a pass.
        </footer>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <Head>Storage</Head>
          <Table head={["Bucket", "Verdict", "Detail"]}>
            {s.buckets.map((b) => (
              <tr key={b.id} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="text-white">{b.id}</Td>
                <Td><Pill tone={tone(b.verdict)}>{b.verdict}</Pill></Td>
                <Td className="text-[#737373]">{b.detail}</Td>
              </tr>
            ))}
          </Table>
        </section>

        <section className={CARD}>
          <Head>Guards</Head>
          <Table head={["Endpoint", "Got", "Want", ""]}>
            {s.guards.map((g) => (
              <tr key={g.path} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="max-w-[240px] truncate text-white">{g.path}</Td>
                <Td className={g.verdict === "ok" ? "text-[#00ff88]" : "text-[#ef4444]"}>{g.status ?? "—"}</Td>
                <Td className="text-[#737373]">{g.expect}</Td>
                <Td><Pill tone={tone(g.verdict)}>{g.verdict}</Pill></Td>
              </tr>
            ))}
          </Table>
          <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
            This deployment asking itself, with no cookies. 4e2451e once removed the session check from the academy
            route and nothing noticed until an anonymous request returned a working signed URL.
          </footer>
        </section>
      </div>

      <section className={CARD}>
        <Head right={<Pill tone="dim">measured {s.bundlesMeasuredAt}</Pill>}>
          Build · deployed {s.commit ?? "locally"}
        </Head>
        <div className="grid gap-px bg-[#262626] sm:grid-cols-3">
          {s.bundles.map((b) => (
            <div key={b.route} className="bg-[#141414] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737373]">{b.route}</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-white">{b.firstLoadKb} kB</p>
              <p className="text-[11px] text-[#737373]">first load JS</p>
            </div>
          ))}
        </div>
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Measured on {s.bundlesMeasuredAt} by <code className="text-[#a3a3a3]">next build</code> and recorded in{" "}
          <code className="text-[#a3a3a3]">lib/adminFacts.ts</code> — nothing at request time can read bundle sizes on
          Vercel, so re-run the build and update them after any change that touches the client bundle.
          {s.commitMessage ? <> Deployed: <span className="text-[#a3a3a3]">{s.commitMessage.slice(0, 120)}</span></> : null}
        </footer>
      </section>
    </div>
  );
}

export function SettingsTab() {
  const { data, error, loading } = useHealth();

  if (loading && !data) return <div className={`${CARD} px-4 py-8 text-center font-mono text-[12px] text-[#737373]`}>Reading…</div>;
  if (error) return <div className={`${CARD} px-4 py-6 font-mono text-[12px] text-[#ef4444]`}>{error}</div>;
  if (!data) return null;
  const st = data.settings;

  const missingRequired = st.env.filter((e) => e.need && !e.set);

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <Head right={<Pill tone={missingRequired.length ? "bad" : "good"}>
          {missingRequired.length ? `${missingRequired.length} missing` : "required set"}
        </Pill>}>
          Environment · presence only
        </Head>
        <Table head={["Variable", "Set", "Needed", "What it does"]}>
          {st.env.map((e) => (
            <tr key={e.key} className="border-b border-[#1c1c1c] last:border-0">
              <Td className="text-white">{e.key}</Td>
              <Td><Pill tone={e.set ? "good" : e.need ? "bad" : "dim"}>{e.set ? "set" : "unset"}</Pill></Td>
              <Td className="text-[#737373]">{e.need ? "required" : "optional"}</Td>
              <Td className="max-w-[420px] whitespace-normal text-[#737373]">{e.why}</Td>
            </tr>
          ))}
        </Table>
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Only whether each name has a value — no value is ever read into this response, so this page cannot leak a key
          even to an admin. Meta Pixel in use: <code className="text-[#a3a3a3]">{st.pixelId}</code>
          {st.pixelOverridden ? " (from the environment)" : " (hardcoded default)"}.
        </footer>
      </section>

      <section className={CARD}>
        <Head right={<Pill tone={st.claimsAgree ? "good" : "bad"}>{st.claimsAgree ? "consistent" : "contradictory"}</Pill>}>
          Member-count copy
        </Head>
        {st.claimsAgree ? <Empty title="Every public page shows the same number." /> : (
          <Table head={["Shown", "Where", "Note"]}>
            {st.memberClaims.map((c) => (
              <tr key={c.where} className="border-b border-[#1c1c1c] last:border-0">
                <Td className="font-bold text-[#facc15]">{c.shown}</Td>
                <Td className="text-white">{c.where}</Td>
                <Td className="max-w-[380px] whitespace-normal text-[#737373]">{c.note}</Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="grid grid-cols-2 gap-px border-t border-[#262626] bg-[#262626]">
          <div className="bg-[#141414] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737373]">Accounts in profiles</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white">{st.actual.accounts}</p>
          </div>
          <div className="bg-[#141414] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#737373]">Approved members</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#00ff88]">{st.actual.approved}</p>
          </div>
        </div>
        <footer className="border-t border-[#262626] px-4 py-2.5 text-[11px] leading-relaxed text-[#737373]">
          Three different figures are rendered to visitors on three pages, and the real row count is below them. Two of
          the three are string literals in JSX, so they are recorded by file and line in{" "}
          <code className="text-[#a3a3a3]">lib/adminFacts.ts</code> rather than imported; the launch.ts value is read
          live. Deciding what the public number should be is a call for you, not a fix to apply quietly.
        </footer>
      </section>
    </div>
  );
}
