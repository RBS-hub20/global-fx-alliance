#!/usr/bin/env python3
"""
GFXA tick relay — one TwelveData WebSocket, every member.

Runs on the VPS beside the MT5 bridge. Holds the single streaming connection a
Grow plan allows (1 connection, 8 WS credits), and pushes what it sees to
/api/market/ingest, which writes one row per symbol that every browser hears
through Supabase Realtime.

Why here and not in the browser: the plan permits one socket, so a client-side
connection would be exceeded by the second member with the page open — and the
API key would have to ship in the page, where any visitor could take it and
spend the quota. Here the key never leaves the box.

Requires:  pip install websockets requests
Env:       TWELVEDATA_API_KEY   the key, from twelvedata.com/account
           VPS_SECRET           the same value Vercel has; signs every push
           INGEST_URL           https://globalfxalliance.io/api/market/ingest
           SYMBOLS              optional; comma-separated, see below

SYMBOLS and the eight-credit ceiling
------------------------------------
The Grow plan allows one connection and eight WebSocket credits, and a credit is
one subscribed symbol. Eight is therefore the hard limit, not a suggestion —
asking for sixteen does not stream sixteen, it streams whichever eight the
server accepts and silently drops the rest. The daemon refuses to send more than
MAX_SYMBOLS and says which ones it left out.

Each entry is either a symbol, or DISPLAY:FEED when the two differ:

    SYMBOLS="XAU/USD,EUR/USD,GBP/USD,USD/JPY,BTC/USD,US30:DJI"

The left side is what is stored in market_ticks and what the dashboard looks up;
the right side is what TwelveData is asked for. That mapping exists because the
two are not the same for indices — US30 is a broker's name for the Dow, not a
TwelveData symbol.

Indices are left out of the default on purpose. TwelveData's public reference
list contains no entry for DOW, SPX, NDX, DJI or IXIC, so the right symbol for
the Dow on this account cannot be confirmed from here and a guess would fail
silently. Add one with the mapping above and read the log: every subscription
the server refuses is printed by name.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time

import requests
import websockets

LOG = logging.getLogger("gfxa-relay")

API_KEY = os.environ.get("TWELVEDATA_API_KEY", "")
SECRET = os.environ.get("VPS_SECRET", "")
INGEST_URL = os.environ.get("INGEST_URL", "https://globalfxalliance.io/api/market/ingest")
# The plan's ceiling. One credit per subscribed symbol.
MAX_SYMBOLS = 8

# Metals, the liquid majors and the two crypto pairs — eight exactly, all
# confirmed to exist on TwelveData. Override with SYMBOLS to trade the slots.
DEFAULT_SYMBOLS = "XAU/USD,XAG/USD,EUR/USD,GBP/USD,USD/JPY,AUD/USD,BTC/USD,ETH/USD"


def parse_symbols(raw: str) -> dict[str, str]:
    """`DISPLAY:FEED` or plain `SYMBOL`, mapped display -> what to ask for."""
    out: dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        display, _, feed = part.partition(":")
        display = display.strip().upper()
        out[display] = (feed.strip() or display).upper()
    return out


SYMBOL_MAP = parse_symbols(os.environ.get("SYMBOLS", DEFAULT_SYMBOLS))
if len(SYMBOL_MAP) > MAX_SYMBOLS:
    _dropped = list(SYMBOL_MAP)[MAX_SYMBOLS:]
    SYMBOL_MAP = {k: SYMBOL_MAP[k] for k in list(SYMBOL_MAP)[:MAX_SYMBOLS]}
else:
    _dropped = []

# TwelveData speaks in feed symbols; everything else here speaks in display ones.
FEED_TO_DISPLAY = {v: k for k, v in SYMBOL_MAP.items()}
SYMBOLS = list(SYMBOL_MAP)
FEED_SYMBOLS = list(SYMBOL_MAP.values())

WS_URL = "wss://ws.twelvedata.com/v1/quotes/price?apikey=" + API_KEY
QUOTE_URL = "https://api.twelvedata.com/quote"

# One push every two seconds per symbol. Gold prints far faster than that, and
# nobody reads a number that is replaced before it renders — this is what keeps
# the row from being rewritten hundreds of times a second for no one's benefit.
PUSH_EVERY = 2.0
# The previous close, for the percentage. Refreshed on a timer rather than per
# tick: it changes once a day and the plan's REST budget is 55 calls a minute.
CLOSE_REFRESH = 600.0

_last_push: dict[str, float] = {}
_prev_close: dict[str, float] = {}
_closes_at = 0.0


def refresh_closes() -> None:
    """Previous close per symbol, so change_percent is a real number."""
    global _closes_at
    for display, feed in SYMBOL_MAP.items():
        try:
            r = requests.get(QUOTE_URL, params={"symbol": feed, "apikey": API_KEY}, timeout=10)
            data = r.json()
            close = data.get("previous_close") or data.get("close")
            if close:
                _prev_close[display] = float(close)
            elif data.get("status") == "error":
                # Names the symbol the account cannot see, rather than leaving a
                # percentage quietly missing.
                LOG.warning("quote for %s (%s): %s", display, feed, data.get("message", "")[:120])
        except Exception as exc:  # noqa: BLE001 - a missing percentage is not fatal
            LOG.warning("previous close for %s failed: %s", display, exc)
    _closes_at = time.time()


def push(symbol: str, price: float) -> None:
    """Sign and POST one tick. The signature is over the exact bytes sent."""
    prev = _prev_close.get(symbol)
    payload = {
        "symbol": symbol,
        "price": price,
        "change_percent": round((price - prev) / prev * 100, 4) if prev else None,
        "source": "twelvedata-ws",
        # Inside the signed body, so it cannot be adjusted without breaking the
        # signature. That is what makes the server's replay check work.
        "ts": int(time.time() * 1000),
    }
    body = json.dumps(payload, separators=(",", ":"))
    signature = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    try:
        r = requests.post(
            INGEST_URL,
            data=body,
            headers={"Content-Type": "application/json", "X-Signature": signature},
            timeout=8,
        )
        if r.status_code != 200:
            LOG.warning("ingest %s: %s %s", symbol, r.status_code, r.text[:160])
    except Exception as exc:  # noqa: BLE001 - the next tick is two seconds away
        LOG.warning("ingest %s failed: %s", symbol, exc)


async def stream() -> None:
    """One connection, resubscribed on every reconnect."""
    async with websockets.connect(WS_URL, ping_interval=20, ping_timeout=20) as ws:
        await ws.send(json.dumps({"action": "subscribe", "params": {"symbols": ",".join(FEED_SYMBOLS)}}))
        LOG.info("requested %d of %d credits: %s", len(FEED_SYMBOLS), MAX_SYMBOLS, ", ".join(FEED_SYMBOLS))

        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event")
            if event == "subscribe-status":
                # Printed by name either way. A symbol this account cannot see
                # is refused here and would otherwise just never tick, which
                # looks identical to a quiet market.
                success = [s.get("symbol") for s in msg.get("success", [])]
                fails = [s.get("symbol") for s in msg.get("fails", [])]
                if success:
                    LOG.info("streaming: %s", ", ".join(filter(None, success)))
                if fails:
                    LOG.error("REFUSED by TwelveData: %s — check the symbol or the plan", ", ".join(filter(None, fails)))
                continue
            if event != "price":
                continue

            feed_symbol = msg.get("symbol")
            price = msg.get("price")
            # Back to the name the dashboard uses before anything is stored.
            symbol = FEED_TO_DISPLAY.get(str(feed_symbol).upper())
            if symbol is None or price is None:
                continue

            now = time.time()
            if now - _last_push.get(symbol, 0.0) < PUSH_EVERY:
                continue
            _last_push[symbol] = now

            if now - _closes_at > CLOSE_REFRESH:
                refresh_closes()

            push(symbol, float(price))


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    missing = [n for n, v in (("TWELVEDATA_API_KEY", API_KEY), ("VPS_SECRET", SECRET)) if not v]
    if missing:
        raise SystemExit("missing environment: " + ", ".join(missing))

    if _dropped:
        LOG.error(
            "SYMBOLS asked for more than the plan's %d credits; not subscribing: %s",
            MAX_SYMBOLS, ", ".join(_dropped),
        )
    LOG.info("relaying %s", ", ".join(f"{d}<-{f}" if d != f else d for d, f in SYMBOL_MAP.items()))

    refresh_closes()
    backoff = 1.0
    while True:
        try:
            await stream()
            backoff = 1.0  # a clean close is not a failure; reconnect promptly
        except Exception as exc:  # noqa: BLE001 - this process must not die
            LOG.warning("stream dropped (%s); retrying in %.0fs", exc, backoff)
        await asyncio.sleep(backoff)
        # Capped so a long outage does not leave the page without a price for
        # an hour once the other end comes back.
        backoff = min(backoff * 2, 60.0)


if __name__ == "__main__":
    asyncio.run(main())
