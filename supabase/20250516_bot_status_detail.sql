-- Detail the Live Market Brain renders.
--
-- The panel was asked to show "TRENDING MODE — BUY ONLY", "Confidence 84%",
-- "Guardian passed • Journal green • No news block" and an entry zone. None of
-- those had a column, and hardcoding them would put a fixed 84% on every
-- member's screen forever — a number that looks like a live reading and is not.
-- They are columns now; the panel shows "—" until the engine writes them.
--
-- Idempotent; safe to run repeatedly. Run 20250515_ai_execution_bot.sql first.

alter table public.bot_status add column if not exists confidence      numeric(5,2)
  check (confidence is null or (confidence >= 0 and confidence <= 100));

-- What the engine will accept right now, not a recommendation to the member.
alter table public.bot_status add column if not exists direction       text
  check (direction is null or direction in ('BUY_ONLY','SELL_ONLY','BOTH','NONE'));

alter table public.bot_status add column if not exists regime          text;

-- The three gates behind the mode. Nullable, because "not reported" and
-- "reported false" are different things and the panel renders them differently.
alter table public.bot_status add column if not exists guardian_passed boolean;
alter table public.bot_status add column if not exists journal_ok      boolean;
alter table public.bot_status add column if not exists news_block      boolean;

-- Pattern radar detail.
alter table public.bot_status add column if not exists pattern_price   numeric(18,5);
alter table public.bot_status add column if not exists pattern_detail  text;

-- Entry zone drawn on the chart. Both or neither; a half-set band would render
-- as a line at zero.
alter table public.bot_status add column if not exists entry_zone_low  numeric(18,5);
alter table public.bot_status add column if not exists entry_zone_high numeric(18,5);
alter table public.bot_status add constraint entry_zone_pair_or_none
  check ((entry_zone_low is null) = (entry_zone_high is null)) not valid;

/*
 * The SELECT grant from the first migration was written column-free
 * (`grant select on ... to authenticated`), so it already covers everything
 * added here — no re-grant needed. bot_status carries no secrets; the column
 * revokes on vt_accounts are the ones that matter and are untouched.
 */

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'bot_status'
 order by ordinal_position;
