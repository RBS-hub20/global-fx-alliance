-- Live ticks relayed from the VPS, for Market News.
--
-- Run after the earlier migrations. Idempotent; safe to run repeatedly.
--
-- The relay opens one TwelveData WebSocket on the VPS and pushes what it sees
-- here; every member's browser then listens to this table through Supabase
-- Realtime. One upstream connection serves everyone, which is what makes it fit
-- a Grow plan whose limit is a single socket — and the API key stays on the VPS
-- rather than in a NEXT_PUBLIC_ variable where any visitor could lift it.

/*
 * One row per symbol, updated in place — not one row per tick.
 *
 * Gold prints many times a second. Inserting each one would be millions of rows
 * a week to render a single number that is replaced before anyone reads it, and
 * Realtime would deliver every one of them to every open tab. The table holds
 * the latest state and Realtime fires on the UPDATE, which is the same event
 * from the browser's point of view and costs nothing to keep.
 */
create table if not exists public.market_ticks (
  symbol        text primary key,
  price         numeric not null,
  change_percent numeric,
  rsi           numeric,
  bb_width      numeric,
  ema50_dist    numeric,
  adx           numeric,
  -- Anything the relay wants to carry that has no column yet.
  data          jsonb not null default '{}'::jsonb,
  source        text not null default 'twelvedata-ws',
  -- When the price was observed upstream, which is not when the row was written.
  observed_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.market_ticks enable row level security;

drop policy if exists market_ticks_read on public.market_ticks;

/*
 * Readable by any signed-in member, and by nobody else.
 *
 * This is a price, not personal data — but it is paid market data, and `to
 * authenticated` keeps it off the public anon key, which is in every page of
 * the site. Writes have no policy at all: only /api/market/ingest, holding the
 * service-role key and checking an HMAC, puts anything in here.
 */
create policy market_ticks_read
  on public.market_ticks for select
  to authenticated
  using (true);

-- Realtime has to be told. Without this the table updates and no browser hears.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'market_ticks'
  ) then
    alter publication supabase_realtime add table public.market_ticks;
  end if;
end $$;

-- Realtime sends only the primary key on an UPDATE unless the table says
-- otherwise; the payload needs the price in it.
alter table public.market_ticks replica identity full;
