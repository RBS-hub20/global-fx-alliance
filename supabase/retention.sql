-- Retention tables: daily check-in streaks and the shoutbox.
-- Idempotent; safe to run repeatedly.

create table if not exists public.user_streaks (
  email           text primary key,
  current_streak  int  not null default 0,
  longest_streak  int  not null default 0,
  last_checkin    date,
  total_checkins  int  not null default 0,
  rep_earned      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.shoutbox (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  -- Stable pseudonym derived from the email. Displayed instead of the address
  -- so a public channel never publishes members' emails.
  handle      text not null,
  message     text not null check (char_length(message) between 1 and 200),
  created_at  timestamptz not null default now()
);

create index if not exists idx_shoutbox_created on public.shoutbox (created_at desc);
create index if not exists idx_streaks_current  on public.user_streaks (current_streak desc, longest_streak desc);
create index if not exists idx_streaks_checkin  on public.user_streaks (last_checkin);

-- RLS on with NO policies, matching verified_users.
--
-- The brief's `create policy ... for all using (true) with check (true)` does not
-- restrict the role it applies to, so it would grant the **anon** key full read
-- and write on both tables — every member's email, and the ability to post as
-- anyone. The service-role key used by the API bypasses RLS and needs no policy,
-- so the safe configuration is none at all.
alter table public.user_streaks enable row level security;
alter table public.shoutbox     enable row level security;

drop policy if exists "Allow service role all" on public.user_streaks;
drop policy if exists "Allow service role all" on public.shoutbox;

-- For a table that already exists without it.
alter table public.shoutbox add column if not exists handle text;
update public.shoutbox set handle = 'trader' where handle is null;
alter table public.shoutbox alter column handle set not null;
