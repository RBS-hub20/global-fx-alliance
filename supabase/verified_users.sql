-- Deposit-verification queue for the partner (IB) gate.
--
-- Run this in the Supabase SQL editor. If the table already exists with
-- different column names, the API returns Postgres's own error verbatim
-- (e.g. "column verified_users.server does not exist"), so a mismatch is
-- visible immediately rather than failing silently.

create table if not exists public.verified_users (
  id              uuid primary key default gen_random_uuid(),
  email           text        not null,
  broker          text        not null check (broker in ('VTMarkets','PUPrime','Vantage')),
  account_number  text        not null,
  server          text,
  method          text        not null default 'form'    check (method in ('form','screenshot')),
  ib_code         text,
  ib_click_time   bigint,
  -- What an admin read in the broker's IB portal. Null until reviewed, never a
  -- figure the applicant supplied.
  deposit         numeric,
  status          text        not null default 'pending' check (status in ('pending','verified','rejected')),
  rejected_reason text,
  -- Object path inside the private proofs bucket, not a public URL.
  screenshot_url  text,
  created_at      timestamptz not null default now(),
  verified_at     timestamptz
);

create index if not exists verified_users_email_idx      on public.verified_users (email, created_at desc);
create index if not exists verified_users_status_idx     on public.verified_users (status, created_at desc);

-- Row-level security on, with no policies: the service-role key used by the API
-- bypasses RLS, and nothing else should ever reach this table. Without this,
-- the anon key could read every applicant's email and account number.
alter table public.verified_users enable row level security;

-- Private bucket for deposit screenshots. These carry account numbers, names and
-- balances, so it must not be public — the admin route mints a five-minute
-- signed URL when a reviewer opens one.
insert into storage.buckets (id, name, public)
values ('verification-proofs', 'verification-proofs', false)
on conflict (id) do update set public = false;

-- ---------------------------------------------------------------------------
-- Migration for a table that already exists with fewer columns.
-- Safe to run repeatedly.

alter table public.verified_users add column if not exists server          text;
alter table public.verified_users add column if not exists method          text default 'form';
alter table public.verified_users add column if not exists ib_code         text;
alter table public.verified_users add column if not exists ib_click_time   bigint;
alter table public.verified_users add column if not exists deposit         numeric;
alter table public.verified_users add column if not exists rejected_reason text;
alter table public.verified_users add column if not exists screenshot_url  text;
alter table public.verified_users add column if not exists verified_at     timestamptz;
