/**
 * Broker registry, kept runtime-neutral.
 *
 * `ibTracking.ts` is "use client" because it touches localStorage and cookies,
 * and importing that into an Edge route strips its exports — `isBroker` came
 * back undefined and the verify route threw. One definition, both runtimes.
 */

export const BROKERS = ["VTMarkets", "PUPrime", "Vantage"] as const;
export type Broker = (typeof BROKERS)[number];

export interface BrokerInfo {
  id: Broker;
  label: string;
  /** Where the reader signs up. The code comes from the server, not from here. */
  host: string;
  /** Server string pattern the reader will see in their terminal. */
  serverHint: string;
}

export const BROKER_INFO: Record<Broker, BrokerInfo> = {
  VTMarkets: { id: "VTMarkets", label: "VT Markets", host: "https://www.vtmarkets.com", serverHint: "VTMarkets-Live / VTMarkets-Real" },
  PUPrime: { id: "PUPrime", label: "PU Prime", host: "https://www.puprime.com", serverHint: "PUPrime-Live" },
  Vantage: { id: "Vantage", label: "Vantage", host: "https://www.vantagemarkets.com", serverHint: "VantageInternational-Live" },
};

export function isBroker(v: string | null | undefined): v is Broker {
  return !!v && (BROKERS as readonly string[]).includes(v);
}
