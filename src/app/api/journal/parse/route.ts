import { NextResponse } from "next/server";
import { computeAnalytics, parseTradesCSV } from "@/lib/journalParser";
import { SAMPLE_STATEMENT_CSV } from "@/lib/journalSample";

export const runtime = "edge";

/**
 * Parses an MT4/MT5 statement into analytics.
 *
 * Stateless by design: the upload is parsed in memory and nothing is written
 * anywhere. The dashboard does not even call this — it runs the same parser in
 * the browser so a trading history never leaves the device — but the endpoint
 * exists for programmatic use, and behaves the same way.
 *
 * Accepts multipart/form-data (`file`), raw text/csv, or no body at all, in which
 * case it returns the sample statement clearly flagged `isReal: false`.
 */

const MAX_BYTES = 2_000_000;

export async function POST(request: Request) {
  const tz = Number(new URL(request.url).searchParams.get("tz") ?? 4);
  const tzOffset = Number.isFinite(tz) ? Math.max(-12, Math.min(14, tz)) : 4;

  let csv = "";
  let fileName = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file && typeof file !== "string") {
        if (file.size > MAX_BYTES) {
          return NextResponse.json(
            { ok: false, message: "File too large — statements over 2 MB are not accepted." },
            { status: 413 }
          );
        }
        fileName = file.name ?? "";
        csv = await file.text();
      }
    } else {
      csv = await request.text();
    }
  } catch {
    csv = "";
  }

  const isReal = csv.trim().length > 0;
  const source = isReal ? csv : SAMPLE_STATEMENT_CSV;
  const trades = parseTradesCSV(source, fileName);

  if (isReal && trades.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No trades found. Export from MT4 as Account History → Save as Report, or from MT5 as History → Report, then upload the CSV.",
      },
      { status: 422 }
    );
  }

  const analytics = computeAnalytics(trades, tzOffset);

  return NextResponse.json(
    {
      ok: true,
      trades,
      analytics,
      isReal,
      badge: isReal ? "REAL" : "SAMPLE",
      count: trades.length,
      fileName: fileName || null,
      // Nothing is persisted; this only describes what was parsed in-request.
      stored: false,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET() {
  const trades = parseTradesCSV(SAMPLE_STATEMENT_CSV, "");
  return NextResponse.json(
    {
      ok: true,
      trades,
      analytics: computeAnalytics(trades, 4),
      isReal: false,
      badge: "SAMPLE",
      count: trades.length,
      stored: false,
    },
    { headers: { "Cache-Control": "public, s-maxage=300" } }
  );
}
