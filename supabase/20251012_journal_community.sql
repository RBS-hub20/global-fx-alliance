-- Opt-in community averages for the journal.
--
-- Run after supabase/20251011_journal.sql. Idempotent.
--
-- Deliberately not a leaderboard. "Trader #1 — 65% win — +$5,000" is not
-- anonymous in a community of twelve: everyone knows who trades gold, and the
-- P&L itself identifies the person. An opt-in box does not fix that, it only
-- gives it the appearance of consent. What this returns is one set of averages
-- with nobody pointed at.

alter table public.journal_settings
  add column if not exists share_anonymous boolean not null default false;

/*
 * Averages across members who opted in — and nothing at all below a floor.
 *
 * MIN_CONTRIBUTORS is the part that does the work. With one contributor the
 * "community average" is that person's exact statistics published to everyone
 * else; with two, anyone who knows their own numbers can subtract them and read
 * the other's. Five is the smallest number where a single member's figures stop
 * being recoverable from the mean, so below it the function returns the count
 * and no statistics.
 *
 * Averaged per member rather than over all trades, so one member who takes
 * three hundred trades does not become the community.
 *
 * SECURITY DEFINER because it reads other members' rows, which RLS correctly
 * forbids the caller from touching directly. It returns aggregates only and
 * takes no arguments, so there is nothing to steer it with; search_path is
 * pinned so nothing can be shadowed under it.
 */
create or replace function public.journal_community_stats()
returns table (
  contributors      integer,
  minimum           integer,
  avg_win_rate      numeric,
  avg_profit_factor numeric,
  avg_expectancy    numeric,
  avg_win           numeric,
  avg_loss          numeric,
  avg_trades        numeric
)
language sql
security definer
set search_path = public
as $$
  with closed as (
    select
      t.user_id,
      coalesce(t.pnl, 0) - abs(coalesce(t.fees, 0)) as net
    from public.journal_trades t
    join public.journal_settings s
      on s.user_id = t.user_id and s.share_anonymous is true
    where t.outcome is not null or t.exit_price is not null
  ),
  per_user as (
    select
      user_id,
      count(*)                                            as trades,
      count(*) filter (where net > 0)                     as wins,
      sum(net) filter (where net > 0)                     as gross_win,
      abs(coalesce(sum(net) filter (where net < 0), 0))   as gross_loss,
      avg(net)                                            as expectancy,
      avg(net) filter (where net > 0)                     as avg_win,
      abs(coalesce(avg(net) filter (where net < 0), 0))   as avg_loss
    from closed
    group by user_id
    -- A member with two trades has no meaningful win rate to contribute.
    having count(*) >= 5
  ),
  counted as (select count(*)::integer as n from per_user)
  select
    counted.n,
    5,
    case when counted.n >= 5 then round(avg(per_user.wins::numeric / per_user.trades * 100), 1) end,
    case when counted.n >= 5 then round(avg(
      case when per_user.gross_loss > 0 then per_user.gross_win / per_user.gross_loss end), 2) end,
    case when counted.n >= 5 then round(avg(per_user.expectancy), 2) end,
    case when counted.n >= 5 then round(avg(per_user.avg_win), 2) end,
    case when counted.n >= 5 then round(avg(per_user.avg_loss), 2) end,
    case when counted.n >= 5 then round(avg(per_user.trades), 1) end
  from counted left join per_user on true
  group by counted.n;
$$;

revoke all on function public.journal_community_stats() from public, anon;
grant execute on function public.journal_community_stats() to authenticated, service_role;
