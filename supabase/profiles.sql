-- Member accounts, keyed to Supabase Auth.
--
-- This is the first thing in the project that is real access control rather than
-- a convention: until now "verified" was a flag in localStorage that anyone
-- could set from devtools. A row here is created by signup and can only be
-- promoted by an admin holding the service-role key.
--
-- Idempotent; safe to run repeatedly.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type member_status as enum ('pending','approved','rejected','banned');
  end if;
end $$;

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  account_number text not null,
  server         text,
  broker         text not null default 'VT Markets',
  status         member_status not null default 'pending',
  -- Filled by whoever reviewed it, so a decision is attributable.
  reviewed_at    timestamptz,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists profiles_status_idx  on public.profiles (status, created_at desc);
-- Not unique: a rejected applicant may legitimately re-register the same
-- account. Indexed so an admin can spot two people claiming one account.
create index if not exists profiles_account_idx on public.profiles (account_number);

alter table public.profiles enable row level security;

drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "insert own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

-- A member sees their own row and nobody else's.
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

/*
 * Signup writes its own row — and can only ever write a pending one.
 *
 * `auth.uid() = id` alone is not enough: the client controls every column it
 * inserts, so without the status check a registrant could simply send
 * status = 'approved' and walk straight past the queue. This is the difference
 * between a gate and a suggestion.
 */
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and status = 'pending');

/*
 * Deliberately no UPDATE and no DELETE policy for members.
 *
 * With RLS enabled and no policy, those operations are refused for everyone
 * except the service-role key, which bypasses RLS entirely. That is what keeps
 * status promotion in the admin routes and out of the browser. Do not add a
 * permissive update policy here without excluding the status column.
 */
