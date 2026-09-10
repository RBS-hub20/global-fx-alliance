-- Community layer for the Market Analysis terminal: a daily bias poll and
-- member-proposed price levels.
--
-- Both are real tables rather than seeded numbers. A poll that opens at
-- "62% bullish, 47 traders" before anyone has voted is not a community feature,
-- it is a decoration — and the first member to vote and watch the number not
-- move learns the whole panel is decoration. Better to show "no votes yet".
--
-- Idempotent; safe to run repeatedly.

/* ------------------------------------------------------------- bias votes -- */

create table if not exists public.analysis_votes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  pair       text not null,
  -- The vote is for a trading day, so yesterday's conviction does not stay on
  -- the board. Stored as a date rather than derived from created_at at read
  -- time, so the unique constraint below can use it.
  session_day date not null default (now() at time zone 'utc')::date,
  bias       text not null check (bias in ('bullish','bearish','neutral')),
  created_at timestamptz not null default now(),
  -- One member, one pair, one day. Changing your mind updates the row.
  unique (user_id, pair, session_day)
);

create index if not exists analysis_votes_tally_idx
  on public.analysis_votes (pair, session_day);

alter table public.analysis_votes enable row level security;

drop policy if exists "read votes"        on public.analysis_votes;
drop policy if exists "read own vote"    on public.analysis_votes;
drop policy if exists "insert own vote"   on public.analysis_votes;
drop policy if exists "update own vote"   on public.analysis_votes;

/*
 * A member reads their own vote and nobody else's — enough to show the poll
 * pre-filled with what they chose.
 *
 * The tally does NOT come from this table directly. Letting every signed-in
 * member select every row would publish who voted which way, which is not a
 * feature anyone asked for and is not recoverable once members notice. The
 * counts come from bias_tally() below, which returns numbers and no user ids.
 */
create policy "read own vote"
  on public.analysis_votes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own vote"
  on public.analysis_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own vote"
  on public.analysis_votes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy: a vote is withdrawn by changing it, not by erasing it.

/* ---------------------------------------------------------- member levels -- */

create table if not exists public.analysis_levels (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  pair       text not null,
  price      numeric(18,6) not null check (price > 0),
  kind       text not null check (kind in ('support','resistance')),
  note       text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  -- One member cannot post the same level twice to inflate its vote count.
  unique (user_id, pair, price)
);

create index if not exists analysis_levels_pair_idx on public.analysis_levels (pair, created_at desc);

create table if not exists public.analysis_level_votes (
  level_id   uuid not null references public.analysis_levels(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (level_id, user_id)
);

alter table public.analysis_levels      enable row level security;
alter table public.analysis_level_votes enable row level security;

drop policy if exists "read levels"       on public.analysis_levels;
drop policy if exists "insert own level"  on public.analysis_levels;
drop policy if exists "delete own level"  on public.analysis_levels;
drop policy if exists "read level votes"  on public.analysis_level_votes;
drop policy if exists "read own level vote" on public.analysis_level_votes;
drop policy if exists "vote on level"     on public.analysis_level_votes;
drop policy if exists "unvote own"        on public.analysis_level_votes;

-- The level itself is public to members — it is a price on a shared chart, and
-- the board RPC returns the author's display name with it deliberately, so a
-- proposal is attributable. Who *voted* for it is not published.
create policy "read levels"
  on public.analysis_levels for select to authenticated using (true);

create policy "insert own level"
  on public.analysis_levels for insert to authenticated with check (auth.uid() = user_id);

-- A member may withdraw their own proposal; the cascade takes its votes with it.
create policy "delete own level"
  on public.analysis_levels for delete to authenticated using (auth.uid() = user_id);

create policy "read own level vote"
  on public.analysis_level_votes for select to authenticated using (auth.uid() = user_id);

create policy "vote on level"
  on public.analysis_level_votes for insert to authenticated with check (auth.uid() = user_id);

create policy "unvote own"
  on public.analysis_level_votes for delete to authenticated using (auth.uid() = user_id);

/*
 * Deliberately no UPDATE on either levels table. A level's price is what was
 * voted on — letting the author edit it afterwards would silently move the
 * thing other members endorsed.
 */

/* ------------------------------------------------------------------ rpcs -- */

/*
 * Tallies, as functions rather than table reads.
 *
 * SECURITY DEFINER so they can count rows the caller's own policies hide, with
 * `set search_path = public` pinned — a definer function that resolves names
 * through the caller's search_path can be pointed at a different table by
 * whoever calls it. They return counts and display names only; no user id ever
 * leaves either one.
 */

create or replace function public.bias_tally(p_pair text)
returns table (bias text, votes bigint)
language sql
security definer
set search_path = public
as $$
  select v.bias, count(*)::bigint
    from public.analysis_votes v
   where v.pair = p_pair
     and v.session_day = (now() at time zone 'utc')::date
   group by v.bias;
$$;

revoke all on function public.bias_tally(text) from public, anon;
grant execute on function public.bias_tally(text) to authenticated;

create or replace function public.level_board(p_pair text)
returns table (
  id uuid, price numeric, kind text, note text,
  author text, votes bigint, voted boolean, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select l.id,
         l.price,
         l.kind,
         l.note,
         -- Falls back to the address's local part, matching how the rest of the
         -- app names a member who has not set one. Never the raw address.
         coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Member') as author,
         count(lv.user_id)::bigint as votes,
         bool_or(lv.user_id = auth.uid()) as voted,
         l.created_at
    from public.analysis_levels l
    left join public.profiles p              on p.id = l.user_id
    left join public.analysis_level_votes lv on lv.level_id = l.id
   where l.pair = p_pair
   group by l.id, l.price, l.kind, l.note, p.display_name, p.email, l.created_at
   order by count(lv.user_id) desc, l.created_at desc
   limit 20;
$$;

revoke all on function public.level_board(text) from public, anon;
grant execute on function public.level_board(text) to authenticated;

-- ------------------------------------------------------------------ check ---
-- All four should come back true.
select relname, relrowsecurity
  from pg_class
 where relname in ('analysis_votes','analysis_levels','analysis_level_votes');
