-- PNL Calendar — realised P&L per Dubai trading day, from three sources:
--   vps     fills reported by the execution bridge   (/api/bot/fill)
--   import  a broker statement CSV                   (/api/journal/import)
--   manual  a trade typed in by the member           (/api/journal/manual)
--
-- Run after 20250515_ai_execution_bot.sql and 20250516_bot_status_detail.sql.
-- Idempotent: every constraint is dropped before it is added, every object is
-- created with IF NOT EXISTS or OR REPLACE.

/* ==========================================================================
   1. execution_logs — new columns
   ========================================================================== */

/*
 * pnl defaults to NULL, not 0 as first drafted.
 *
 * An approved bot trade is written EXECUTED the moment it fills — hours before
 * it closes and has a P&L. With a default of 0 that open position counts on the
 * calendar as a closed breakeven trade on its entry day, and the day's trade
 * count and win rate are wrong until the close arrives. NULL means "not closed
 * yet", 0 means "closed flat", and the view only counts the second.
 */
alter table public.execution_logs add column if not exists pnl       numeric(18,2);
alter table public.execution_logs add column if not exists source    text not null default 'vps';
alter table public.execution_logs add column if not exists ticket_id text;
alter table public.execution_logs add column if not exists notes     text;

-- P&L is realised at the close, so that is the day it belongs to. executed_at
-- stays the entry fill. The calendar reads coalesce(closed_at, executed_at).
alter table public.execution_logs add column if not exists closed_at timestamptz;

alter table public.execution_logs drop constraint if exists execution_logs_source_check;
alter table public.execution_logs add constraint execution_logs_source_check
  check (source in ('vps','import','manual'));

alter table public.execution_logs drop constraint if exists execution_logs_notes_len;
alter table public.execution_logs add constraint execution_logs_notes_len
  check (notes is null or char_length(notes) <= 280);

/*
 * 'MANUAL' added to the status list.
 *
 * The first migration's check only allows the six bot states, so every import
 * and manual row written with status = 'MANUAL' — which the view filters on —
 * would have failed with a check violation. This is the auto-generated name
 * Postgres gave the inline check in 20250515.
 */
do $$
declare c record;
begin
  -- Matched by definition, not only by name: if the inline check from
  -- 20250515 was ever named differently, a name-only drop would skip it
  -- silently and the old list would go on rejecting 'MANUAL'.
  for c in
    select conname from pg_constraint
     where conrelid = 'public.execution_logs'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%PENDING_APPROVAL%'
  loop
    execute format('alter table public.execution_logs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.execution_logs add constraint execution_logs_status_check
  check (status in ('PENDING_APPROVAL','APPROVED','REJECTED','EXECUTED','EXPIRED','FAILED','MANUAL'));

/*
 * price and action were NOT NULL because every row used to be a bot order.
 * A trade typed in by hand has a P&L but often no fill price, and forcing a
 * made-up price into a column the approval route compares against is worse
 * than leaving it empty. Still required for anything the bridge writes.
 */
alter table public.execution_logs alter column price  drop not null;
alter table public.execution_logs alter column action drop not null;

alter table public.execution_logs drop constraint if exists execution_logs_vps_complete;
alter table public.execution_logs add constraint execution_logs_vps_complete
  check (source <> 'vps' or (price is not null and action is not null));

/*
 * The 10-lot ceiling is the bot's safety limit, so it applies to the bot.
 * A member importing a statement that contains one 15-lot trade should not
 * have the whole import rejected by a rule written for automated orders.
 */
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.execution_logs'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%lot%'
  loop
    execute format('alter table public.execution_logs drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.execution_logs add constraint execution_logs_lot_check
  check (lot > 0 and (source <> 'vps' or lot <= 10));

/*
 * Re-importing the same statement must not double the month.
 *
 * Without this, importing September twice turns $517.61 into $1,035.22 and
 * nothing on screen says why. Import writes a content hash of each trade as
 * ticket_id; the bridge writes the MT5 ticket. A plain unique index rather
 * than a partial one: NULLs never collide in a unique index, so manual rows
 * (no ticket) are unaffected, and PostgREST's upsert can target it — it cannot
 * target a partial index.
 */
create unique index if not exists execution_logs_ticket_uniq
  on public.execution_logs (user_id, source, ticket_id);

create index if not exists execution_logs_closed_idx
  on public.execution_logs (user_id, closed_at desc)
  where pnl is not null;

/*
 * RLS: unchanged, deliberately.
 *
 * execution_logs stays SELECT-only to the browser. Imports and manual trades
 * are written by API routes that check the session and force `source` —
 * a member can never write a row claiming source = 'vps', and cannot edit an
 * existing row's P&L from devtools. No new policy is needed for that, and
 * adding an INSERT policy would open exactly what the routes exist to close.
 */

/* ==========================================================================
   2. pnl_calendar view
   ========================================================================== */

/*
 * security_invoker = true is not optional here.
 *
 * A Postgres view runs with its OWNER's privileges unless told otherwise, and
 * the owner is the role that created it — which bypasses RLS. Written as a
 * plain view, `select * from pnl_calendar` from any signed-in member returns
 * every member's daily P&L. The belief that a view "inherits" the table's RLS
 * is only true with this option set. (Needs Postgres 15+, which every current
 * Supabase project runs; on anything older this line errors rather than
 * silently leaking, which is the right way round.)
 *
 * Grouped by user_id and account as well as day: a view keyed on day alone
 * merges members together for any caller that can see more than one of them,
 * such as the service role the bridge uses.
 *
 * Days are Dubai days (UTC+4, no DST), matching Journal Analytics.
 */
create or replace view public.pnl_calendar
with (security_invoker = true) as
select
  l.user_id,
  l.vt_account_id,
  (coalesce(l.closed_at, l.executed_at) at time zone 'Asia/Dubai')::date as day,
  round(sum(l.pnl), 2)                                                  as daily_pnl,
  count(*)                                                              as trades,
  count(*) filter (where l.pnl > 0)                                     as wins,
  count(*) filter (where l.pnl < 0)                                     as losses,
  string_agg(distinct l.source, ',' order by l.source)                  as sources
from public.execution_logs l
where l.status in ('EXECUTED','MANUAL')
  and l.pnl is not null
  and coalesce(l.closed_at, l.executed_at) is not null
group by l.user_id, l.vt_account_id, 3;

revoke all on public.pnl_calendar from anon, authenticated;
grant select on public.pnl_calendar to authenticated;

/* ==========================================================================
   3. member_trading_prefs — goal, weekends, blocked hours
   ========================================================================== */

/*
 * Separate from bot_status on purpose.
 *
 * bot_status is engine state and is read-only to the browser, because a member
 * who could write it could set current_mode = 'GREEN'. A monthly goal or a
 * blocked hour is the member's own preference, and every value it can hold
 * makes the bot trade less, never more — so the member writes it directly.
 * Mixing the two would mean either opening bot_status or routing a goal edit
 * through the service key.
 */
create table if not exists public.member_trading_prefs (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  monthly_goal       numeric(18,2),
  show_weekends      boolean not null default false,
  -- Dubai hours, 0-23. Stored here; enforced by the bridge when it trades.
  blocked_hours      smallint[] not null default '{}',
  default_account_id uuid references public.vt_accounts(id) on delete set null,
  updated_at         timestamptz not null default now()
);

alter table public.member_trading_prefs drop constraint if exists prefs_goal_positive;
alter table public.member_trading_prefs add constraint prefs_goal_positive
  check (monthly_goal is null or monthly_goal > 0);

alter table public.member_trading_prefs drop constraint if exists prefs_hours_valid;
alter table public.member_trading_prefs add constraint prefs_hours_valid
  check (blocked_hours <@ '{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23}'::smallint[]);

alter table public.member_trading_prefs enable row level security;

drop policy if exists prefs_own_select on public.member_trading_prefs;
drop policy if exists prefs_own_insert on public.member_trading_prefs;
drop policy if exists prefs_own_update on public.member_trading_prefs;
drop policy if exists prefs_own_delete on public.member_trading_prefs;

create policy prefs_own_select on public.member_trading_prefs
  for select to authenticated using (auth.uid() = user_id);

/*
 * The account check matters even for a dropdown default. A foreign key only
 * proves the account exists, not whose it is, and FK checks ignore RLS — so
 * without it a member could point their default at another member's account id.
 */
create policy prefs_own_insert on public.member_trading_prefs
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and (default_account_id is null or exists (
      select 1 from public.vt_accounts a where a.id = default_account_id and a.user_id = auth.uid()))
  );

create policy prefs_own_update on public.member_trading_prefs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (default_account_id is null or exists (
      select 1 from public.vt_accounts a where a.id = default_account_id and a.user_id = auth.uid()))
  );

create policy prefs_own_delete on public.member_trading_prefs
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.member_trading_prefs from anon;
grant select, insert, update, delete on public.member_trading_prefs to authenticated;

/* ==========================================================================
   4. Check
   ========================================================================== */

-- Expect: security_invoker=true on the view, and RLS on with 4 policies on prefs.
select c.relname,
       c.relkind,
       c.reloptions,
       c.relrowsecurity as rls_on,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
  from pg_class c
 where c.relname in ('pnl_calendar','member_trading_prefs','execution_logs');

-- Exactly one status check and one lot check should remain.
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.execution_logs'::regclass and contype = 'c'
 order by conname;

-- Empty until an import, a manual add or a bridge fill lands. (Run here as the
-- table owner this shows every member; from the app it shows only your own.)
select * from public.pnl_calendar order by day desc limit 20;
