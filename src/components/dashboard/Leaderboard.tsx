import { LEADERBOARD } from "@/lib/data";

const MEDALS = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];

export function Leaderboard() {
  return (
    <section className="rounded-2xl glass">
      <header className="border-b border-white/[0.08] px-5 py-4">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white">
          Global Trader Leaderboard
        </h2>
      </header>

      <table className="w-full table-fixed text-left">
        <colgroup>
          <col className="w-[64px]" />
          <col />
          <col className="w-[74px]" />
          <col className="w-[78px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-white/[0.06]">
            {["Rank", "Trader", "Country", "Rep"].map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted/70 ${
                  i === 0 ? "pl-5" : ""
                } ${i === 3 ? "pr-5 text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {LEADERBOARD.map((r) => (
            <tr key={r.trader} className="transition-colors duration-200 hover:bg-white/[0.02]">
              <td className="py-3 pl-5 text-[14px] leading-none">
                {r.rank <= 3 ? (
                  <span aria-label={`Rank ${r.rank}`}>{MEDALS[r.rank - 1]}</span>
                ) : (
                  <span className="num-mono text-[13px] text-ink-muted">{r.rank}</span>
                )}
              </td>
              <td className="truncate py-3 pr-2 text-[13px] font-semibold text-white">
                {r.trader}
              </td>
              <td className="py-3 text-[12px] text-ink-muted">
                <span aria-hidden>{r.flag}</span> {r.country}
              </td>
              <td className="py-3 pr-5 text-right num-mono text-[13px] font-semibold text-brand-blue">
                {r.reputation.toLocaleString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="border-t border-white/[0.08] px-5 py-3.5 text-[11px] leading-relaxed text-ink-muted/70">
        Ranked by contribution &amp; reputation — not claimed profits.
      </p>
    </section>
  );
}
