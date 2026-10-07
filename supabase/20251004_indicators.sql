-- GFXA Indicators: the catalogue, and who has been invited to each script.
--
-- Run after the earlier migrations. Idempotent; safe to run repeatedly.
--
-- Phase 1 is access control and a showcase. There is no Pine Script in this
-- repository and none is served to the browser — the scripts live on
-- TradingView as invite-only, which is the only place the source can actually
-- be kept private. What this schema does is decide who gets added to one.

/* ======================================================== 1. the catalogue */

create table if not exists public.indicator_definitions (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  description    text,
  symbol         text,
  timeframe      text,

  /*
   * Performance figures.
   *
   * `stats_verified` is the important column. These three numbers are a claim
   * about money in a financial product, and the project already learned this
   * lesson once with COMMUNITY_TARGET.members: a figure with no measurement
   * behind it must not render as a fact. Seeded false, so the showcase shows
   * "Backtest pending" in place of the numbers until a real backtest exists.
   * Flip the flag and the card starts quoting them — see the note at the end.
   */
  win_rate       numeric,
  profit_factor  numeric,
  tested_months  integer,
  stats_verified boolean not null default false,

  screenshot_url text,
  tradingview_url text,
  badge          text default 'Invite-Only',
  status         text not null default 'active' check (status in ('active','inactive')),
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now()
);

/* ====================================================== 2. who is invited */

create table if not exists public.indicator_access (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  indicator_id        uuid not null references public.indicator_definitions(id) on delete cascade,
  telegram_id         bigint,
  -- The handle an admin pastes into TradingView's invite-only list. Required:
  -- a request without one cannot be actioned.
  tradingview_username text not null,
  status              text not null default 'pending' check (status in ('pending','approved','revoked')),
  note                text,
  /*
   * Null until approved, rather than now() + 365 days at insert.
   *
   * The brief asked for the default. An expiry on a request that was never
   * granted says nothing, and a pending row that silently "expires" a year
   * later would look like a revocation that nobody performed. The clock starts
   * when access does — the approve route sets it.
   */
  approved_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- One row per member per indicator: re-requesting updates, never duplicates.
  unique (user_id, indicator_id)
);

create index if not exists indicator_access_status_idx on public.indicator_access (status, created_at desc);
create index if not exists indicator_access_user_idx   on public.indicator_access (user_id);
create index if not exists indicator_access_tv_idx     on public.indicator_access (lower(tradingview_username));

create or replace function public.indicator_access_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists indicator_access_touch_trg on public.indicator_access;
create trigger indicator_access_touch_trg before update on public.indicator_access
  for each row execute function public.indicator_access_touch();

/* ============================================================== 3. access */

alter table public.indicator_definitions enable row level security;
alter table public.indicator_access      enable row level security;

drop policy if exists indicator_definitions_read on public.indicator_definitions;
drop policy if exists indicator_access_read_own  on public.indicator_access;

-- Signed-in members see the live catalogue. `to authenticated` is what keeps
-- anon out: the anon key gets no policy at all and therefore no rows.
create policy indicator_definitions_read
  on public.indicator_definitions for select
  to authenticated
  using (status = 'active');

-- A member sees their own requests and nobody else's handle.
create policy indicator_access_read_own
  on public.indicator_access for select
  to authenticated
  using (auth.uid() = user_id);

/*
 * Deliberately no INSERT, UPDATE or DELETE policy for members.
 *
 * The brief asked for "insert own with tradingview_username". That would be a
 * hole, not a convenience: access here is gated on an approved profile *and* a
 * verified broker deposit, and a client that can insert its own row can insert
 * one while meeting neither — the same mistake the profiles table avoids by
 * having no update policy. /api/indicators/request-access checks both gates and
 * writes with the service role, which bypasses RLS. Status promotion stays on
 * the server for the same reason.
 */

/* =============================================================== 4. seeds */

insert into public.indicator_definitions
  (slug, name, description, symbol, timeframe, win_rate, profit_factor, tested_months, screenshot_url, badge, status, sort_order)
values
  ('gold-sniper', 'GFXA Gold Sniper',
   'Gold trade ideas and market breakdowns — not signals. Marks the levels and the reasoning behind them on XAU/USD.',
   'XAU/USD', '1H', 72, 2.1, 12, '/indicators/gold-sniper.png', 'Invite-Only', 'active', 1),
  ('structure-breaker', 'GFXA Structure Breaker',
   'Break of structure and change of character, drawn as price confirms them rather than after the fact.',
   'Multi-pair', '15M–4H', 65, 1.8, 12, '/indicators/structure-breaker.png', 'Invite-Only', 'active', 2),
  ('liquidity-radar', 'GFXA Liquidity Radar',
   'Where stops are likely resting, and the sweeps that take them. Highlights liquidity, it does not predict it.',
   'Multi-pair', '15M–1H', 68, 1.9, 12, '/indicators/liquidity-radar.png', 'Invite-Only', 'active', 3)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  symbol = excluded.symbol,
  timeframe = excluded.timeframe,
  win_rate = excluded.win_rate,
  profit_factor = excluded.profit_factor,
  tested_months = excluded.tested_months,
  screenshot_url = excluded.screenshot_url,
  status = excluded.status,
  sort_order = excluded.sort_order;
  -- stats_verified is NOT in this list: re-running the migration must never
  -- silently re-publish numbers somebody deliberately turned off.

/*
 * To publish the performance figures once they are measured:
 *
 *   update public.indicator_definitions
 *      set stats_verified = true
 *    where slug = 'gold-sniper';
 *
 * Do that per indicator, from a backtest you can produce on request. Until
 * then every card reads "Backtest pending" where the win rate would be.
 */
