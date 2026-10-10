-- Trading journal: the log, the daily review, and the rules a member sets
-- for themselves.
--
-- Run after the earlier migrations. Idempotent; safe to run repeatedly.
--
-- What this replaces: a journal kept in localStorage, seeded with eight
-- invented trades. It did not survive a different browser, and a trade log that
-- can vanish is not a trade log.

/* ============================================================== 1. the log */

create table if not exists public.journal_trades (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  symbol         text not null default 'XAU/USD',
  direction      text not null default 'buy' check (direction in ('buy','sell')),
  entry_price    numeric,
  exit_price     numeric,
  size           numeric,

  -- Risk as taken, not as intended. Both are kept because the gap between them
  -- is the thing worth seeing.
  risk_usd       numeric,
  risk_percent   numeric,
  rr             numeric,

  outcome        text check (outcome in ('win','loss','be')),
  pnl            numeric,
  fees           numeric default 0,

  /*
   * The tags are the point of keeping a journal by hand.
   *
   * An imported broker statement already gives price, size and P&L — what it
   * can never give is why the trade was taken, which mistake was made, and what
   * the member felt at the time. These three columns are the only data here
   * that a statement import cannot produce.
   */
  setup_type     text,
  mistake_tag    text,
  emotion        text,

  session        text check (session in ('asia','london','ny','dubai')),
  opened_at      timestamptz,
  closed_at      timestamptz,
  screenshot_url text,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists journal_trades_user_idx    on public.journal_trades (user_id, closed_at desc nulls last);
create index if not exists journal_trades_created_idx on public.journal_trades (user_id, created_at desc);

/* ===================================================== 2. the daily review */

create table if not exists public.journal_daily (
  user_id           uuid not null references auth.users(id) on delete cascade,
  -- One review per trading day, in the member's own calendar.
  day               date not null,

  bias              text check (bias in ('bullish','bearish','neutral')),
  support           numeric,
  resistance        numeric,
  entry_zone        text,
  pre_market_plan   text,

  what_went_well    text,
  what_went_wrong   text,
  what_to_improve   text,
  tomorrow_plan     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, day)
);

/* ========================================================= 3. the own rules */

create table if not exists public.journal_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  -- Percentages need something to be a percentage of. Without this, a "3% daily
  -- loss limit" is a number with no meaning attached.
  account_balance  numeric,
  risk_per_trade   numeric not null default 1,
  daily_loss_limit numeric not null default 3,
  max_trades       integer not null default 3,
  max_loss_streak  integer not null default 2,
  updated_at       timestamptz not null default now()
);

/* ============================================================== 4. access */

alter table public.journal_trades   enable row level security;
alter table public.journal_daily    enable row level security;
alter table public.journal_settings enable row level security;

/*
 * A member's own rows and nothing else — on every verb.
 *
 * Unlike most tables in this project these do take client-side write policies.
 * A journal entry is the member's own record about themselves: there is no
 * privilege in it to escalate, nothing another member can be harmed by, and
 * `with check (auth.uid() = user_id)` makes writing a row under someone else's
 * id impossible. The API still goes through the service role so validation
 * lives in one place, but the policies mean a mistake there cannot expose one
 * member's journal to another.
 */
do $$
declare t text;
begin
  foreach t in array array['journal_trades','journal_daily','journal_settings'] loop
    execute format('drop policy if exists %I_own on public.%I', t, t);
    execute format(
      'create policy %I_own on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t);
  end loop;
end $$;

create or replace function public.journal_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['journal_trades','journal_daily','journal_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.journal_touch()', t, t);
  end loop;
end $$;
