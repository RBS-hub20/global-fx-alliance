"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardHead, Field, PanelHeader, Pills, Select, money } from "@/components/ui/Primitives";
import { PAIRS, getPair, pipValuePerLot } from "@/lib/market";

const MODES = ["Position Size", "Pip Value", "Profit", "Margin"] as const;
type Mode = (typeof MODES)[number];

const num = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function CalculatorPanel() {
  const [mode, setMode] = useState<Mode>("Position Size");

  return (
    <div className="space-y-6">
      <PanelHeader title="Trading Calculator" />
      <Pills options={MODES} value={mode} onChange={setMode} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {mode === "Position Size" ? <PositionSize /> : null}
        {mode === "Pip Value" ? <PipValue /> : null}
        {mode === "Profit" ? <Profit /> : null}
        {mode === "Margin" ? <Margin /> : null}

        <Card className="h-fit">
          <CardHead title="How this is calculated" icon={Calculator} />
          <div className="space-y-3 p-5 text-[13px] leading-relaxed text-ink-muted">
            {mode === "Position Size" ? (
              <>
                <p>Risk amount = balance × risk %.</p>
                <p>Lots = risk amount ÷ (stop in pips × pip value per lot).</p>
                <p>Pip value per lot is the pip size × contract size, converted to USD when the quote currency is not the dollar.</p>
              </>
            ) : null}
            {mode === "Pip Value" ? (
              <>
                <p>Pip value = pip size × contract size × lots.</p>
                <p>Standard lot is 100,000 units, or 100 ounces for gold. A pip is 0.0001 on the majors, 0.01 on yen pairs and 0.1 on gold.</p>
              </>
            ) : null}
            {mode === "Profit" ? (
              <>
                <p>Move in pips = (exit − entry) ÷ pip size, flipped for a short.</p>
                <p>Profit = move in pips × pip value per lot × lots.</p>
              </>
            ) : null}
            {mode === "Margin" ? (
              <>
                <p>Notional = lots × contract size × price.</p>
                <p>Margin required = notional ÷ leverage.</p>
                <p>Free margin is what is left of the balance once that is set aside.</p>
              </>
            ) : null}
            <p className="border-t border-white/[0.08] pt-3 text-[11.5px] text-ink-muted/70">
              Educational tool. Figures are indicative and ignore commission, swap and slippage.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Result({ rows }: { rows: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <dl className="mt-6 divide-y divide-white/[0.06] border-t border-white/[0.08]">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-3.5">
          <dt className="text-[13px] text-ink-muted">{r.label}</dt>
          <dd className={`num-mono text-[17px] font-bold ${r.accent ? "text-brand-blue" : "text-white"}`}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PairSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select label="Pair" value={value} onChange={(e) => onChange(e.target.value)}>
      {PAIRS.map((p) => (
        <option key={p.symbol} value={p.symbol}>{p.symbol}</option>
      ))}
    </Select>
  );
}

function PositionSize() {
  const [balance, setBalance] = useState("10000");
  const [risk, setRisk] = useState("1");
  const [stop, setStop] = useState("25");
  const [symbol, setSymbol] = useState("EUR/USD");

  const out = useMemo(() => {
    const p = getPair(symbol);
    const riskAmount = num(balance) * (num(risk) / 100);
    const perLot = pipValuePerLot(symbol, 1, p.price);
    const stopPips = num(stop);
    const lots = stopPips > 0 && perLot > 0 ? riskAmount / (stopPips * perLot) : 0;
    const contract = symbol.startsWith("XAU") ? 100 : 100_000;
    return { riskAmount, lots, units: lots * contract, perLot };
  }, [balance, risk, stop, symbol]);

  return (
    <Card>
      <CardHead title="Position Size" />
      <div className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account Balance" type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} suffix="USD" />
          <Field label="Risk" type="number" inputMode="decimal" step="0.1" value={risk} onChange={(e) => setRisk(e.target.value)} suffix="%" />
          <Field label="Stop Loss" type="number" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} suffix="pips" />
          <PairSelect value={symbol} onChange={setSymbol} />
        </div>
        <Result
          rows={[
            { label: "Risk amount", value: money(out.riskAmount) },
            { label: "Pip value / lot", value: money(out.perLot) },
            { label: "Position size", value: `${Math.round(out.units).toLocaleString("en-US")} units` },
            { label: "Lot size", value: out.lots.toFixed(2), accent: true },
          ]}
        />
      </div>
    </Card>
  );
}

function PipValue() {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [lots, setLots] = useState("1");
  const [price, setPrice] = useState(String(getPair("EUR/USD").price));

  const out = useMemo(() => {
    const value = pipValuePerLot(symbol, num(lots), num(price));
    return { value, perLot: pipValuePerLot(symbol, 1, num(price)) };
  }, [symbol, lots, price]);

  return (
    <Card>
      <CardHead title="Pip Value" />
      <div className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PairSelect
            value={symbol}
            onChange={(v) => { setSymbol(v); setPrice(String(getPair(v).price)); }}
          />
          <Field label="Lot Size" type="number" inputMode="decimal" step="0.01" value={lots} onChange={(e) => setLots(e.target.value)} suffix="lots" />
          <Field label="Current Price" type="number" inputMode="decimal" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Result
          rows={[
            { label: "Pip size", value: String(getPair(symbol).pipSize) },
            { label: "Value per lot", value: money(out.perLot) },
            { label: "Value per pip", value: money(out.value), accent: true },
          ]}
        />
      </div>
    </Card>
  );
}

function Profit() {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [side, setSide] = useState<"Long" | "Short">("Long");
  const [entry, setEntry] = useState("1.1693");
  const [exit, setExit] = useState("1.1742");
  const [lots, setLots] = useState("1");

  const out = useMemo(() => {
    const p = getPair(symbol);
    const diff = num(exit) - num(entry);
    const pips = (side === "Long" ? diff : -diff) / p.pipSize;
    const profit = pips * pipValuePerLot(symbol, num(lots), num(exit) || p.price);
    return { pips, profit };
  }, [symbol, side, entry, exit, lots]);

  return (
    <Card>
      <CardHead title="Profit / Loss" />
      <div className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PairSelect
            value={symbol}
            onChange={(v) => {
              setSymbol(v);
              setEntry(String(getPair(v).price));
              setExit(String(getPair(v).price));
            }}
          />
          <Select label="Direction" value={side} onChange={(e) => setSide(e.target.value as "Long" | "Short")}>
            <option>Long</option>
            <option>Short</option>
          </Select>
          <Field label="Entry Price" type="number" inputMode="decimal" step="0.0001" value={entry} onChange={(e) => setEntry(e.target.value)} />
          <Field label="Exit Price" type="number" inputMode="decimal" step="0.0001" value={exit} onChange={(e) => setExit(e.target.value)} />
          <Field label="Lot Size" type="number" inputMode="decimal" step="0.01" value={lots} onChange={(e) => setLots(e.target.value)} suffix="lots" />
        </div>
        <Result
          rows={[
            { label: "Move", value: `${out.pips >= 0 ? "+" : ""}${out.pips.toFixed(1)} pips` },
            { label: "Result", value: money(out.profit), accent: true },
          ]}
        />
      </div>
    </Card>
  );
}

function Margin() {
  const [symbol, setSymbol] = useState("EUR/USD");
  const [lots, setLots] = useState("1");
  const [leverage, setLeverage] = useState("100");
  const [balance, setBalance] = useState("10000");

  const out = useMemo(() => {
    const p = getPair(symbol);
    const contract = symbol.startsWith("XAU") ? 100 : 100_000;
    const notional = num(lots) * contract * p.price;
    const lev = num(leverage) || 1;
    const required = notional / lev;
    return { notional, required, free: num(balance) - required, used: (required / (num(balance) || 1)) * 100 };
  }, [symbol, lots, leverage, balance]);

  return (
    <Card>
      <CardHead title="Margin" />
      <div className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PairSelect value={symbol} onChange={setSymbol} />
          <Field label="Lot Size" type="number" inputMode="decimal" step="0.01" value={lots} onChange={(e) => setLots(e.target.value)} suffix="lots" />
          <Select label="Leverage" value={leverage} onChange={(e) => setLeverage(e.target.value)}>
            {["500", "200", "100", "50", "30", "20", "10"].map((l) => (
              <option key={l} value={l}>1:{l}</option>
            ))}
          </Select>
          <Field label="Account Balance" type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} suffix="USD" />
        </div>
        <Result
          rows={[
            { label: "Notional value", value: money(out.notional) },
            { label: "Margin required", value: money(out.required), accent: true },
            { label: "Free margin", value: money(out.free) },
            { label: "Margin used", value: `${out.used.toFixed(1)}%` },
          ]}
        />
      </div>
    </Card>
  );
}
