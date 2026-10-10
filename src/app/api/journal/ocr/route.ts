import { NextResponse } from "next/server";
import { journalContext } from "@/lib/journalApi";
import { estimatePnl, normaliseSymbolInput } from "@/lib/journalPro";
import { cleanFields, describe, reviewExtraction } from "@/lib/tradeOcr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 25_000;
/** Roughly 6 MB of image once base64 is accounted for. */
const MAX_BASE64 = 8_000_000;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const PROMPT = [
  "You are reading a screenshot of a trading platform's position or order history.",
  "Extract exactly one trade and return JSON only, no prose and no code fence:",
  '{"symbol":string|null,"direction":"buy"|"sell"|null,"entry":number|null,"exit":number|null,"size":number|null,"pnl":number|null,"fees":number|null}',
  "",
  "symbol: the instrument as printed, e.g. XAUUSD, EURUSD, US30, BTCUSD. Do not invent one.",
  "direction: buy for Buy/Bought/Long, sell for Sell/Sold/Short.",
  "entry: the open price. exit: the close or current price.",
  "size: the volume in lots.",
  "pnl: the profit or loss figure, negative for a loss.",
  "fees: commission and swap combined, as printed.",
  "",
  "Use null for anything not clearly legible. Do not guess a value from context,",
  "do not calculate a field from the others, and do not round. A null is more",
  "useful than a plausible number that is wrong.",
].join("\n");

/**
 * Read a trade off a screenshot.
 *
 * The image is held in memory for the length of the request and never written
 * anywhere — no bucket, no table, no log. It is sent to OpenAI to be read,
 * which is the one thing about this that leaves the device, and the panel says
 * so before anything is uploaded.
 *
 * Nothing it returns is saved. The values go into the form for the member to
 * check against their platform, which stays the authority on what they were
 * actually paid — the same rule the live-price button follows.
 */
export async function POST(request: Request) {
  const ctx = await journalContext();
  if (ctx instanceof NextResponse) return ctx;

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, message: "Screenshot reading needs OPENAI_API_KEY on the server." },
      { status: 503 }
    );
  }

  let body: { image?: unknown };
  try { body = (await request.json()) as typeof body; }
  catch { return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 }); }

  const image = typeof body.image === "string" ? body.image : "";
  const match = image.match(/^data:([a-z/+-]+);base64,/i);
  if (!match || !ALLOWED.includes(match[1].toLowerCase())) {
    return NextResponse.json({ ok: false, message: "Send a PNG, JPEG or WebP screenshot." }, { status: 400 });
  }
  if (image.length > MAX_BASE64) {
    return NextResponse.json({ ok: false, message: "That image is too large — crop to the trade row." }, { status: 413 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let text: string | null = null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        // Nothing creative is wanted here: the same screenshot should read the
        // same way twice.
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[journal/ocr] model call failed", res.status, detail.slice(0, 200));
      return NextResponse.json({ ok: false, message: `The reader could not be reached (${res.status}).` }, { status: 502 });
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    text = json?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { ok: false, message: aborted ? "Reading the screenshot timed out." : "Could not read that screenshot." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!text) return NextResponse.json({ ok: false, message: "Nothing came back from the reader." }, { status: 502 });

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, message: "The reader did not return readable fields." }, { status: 502 }); }

  const fields = cleanFields(parsed);

  // Worked out here rather than asked of the model: a figure it reports about
  // its own accuracy is not measured against anything.
  const expected = fields.symbol && fields.direction
    ? estimatePnl(normaliseSymbolInput(fields.symbol), fields.entry, fields.exit, fields.size, fields.direction)
    : null;

  return NextResponse.json(
    { ok: true, fields, review: reviewExtraction(fields, expected), summary: describe(fields), expectedPnl: expected },
    { headers: { "Cache-Control": "no-store" } }
  );
}
