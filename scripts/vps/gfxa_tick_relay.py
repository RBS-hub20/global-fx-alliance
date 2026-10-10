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
           SYMBOLS              optional, default "XAU/USD"
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
SYMBOLS = [s.strip() for s in os.environ.get("SYMBOLS", "XAU/USD").split(",") if s.strip()]

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
    for symbol in SYMBOLS:
        try:
            r = requests.get(QUOTE_URL, params={"symbol": symbol, "apikey": API_KEY}, timeout=10)
            data = r.json()
            close = data.get("previous_close") or data.get("close")
            if close:
                _prev_close[symbol] = float(close)
        except Exception as exc:  # noqa: BLE001 - a missing percentage is not fatal
            LOG.warning("previous close for %s failed: %s", symbol, exc)
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
        await ws.send(json.dumps({"action": "subscribe", "params": {"symbols": ",".join(SYMBOLS)}}))
        LOG.info("subscribed: %s", ", ".join(SYMBOLS))

        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event = msg.get("event")
            if event == "subscribe-status" and msg.get("status") != "ok":
                LOG.error("subscribe refused: %s", msg)
                continue
            if event != "price":
                continue

            symbol = msg.get("symbol")
            price = msg.get("price")
            if symbol not in SYMBOLS or price is None:
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
