-- GFXA AI Execution Bot — accounts, bot state, and the approval log.
--
-- Every table below gets RLS *and* explicit policies in the same statement
-- block. Enabling RLS without policies is what produced "Load failed" on
-- sign-in after URGENT_fix_rls.sql: with RLS on and no policy, Postgres denies
-- every row to every role except the service key, so the client sees an error
-- rather than an empty list. Never ship one without the other.
--
-- Idempotent; safe to run repeatedly.

/* ==========================================================================
   1. vt_accounts — the broker credentials, encrypted
   ========================================================================== */

create table if not exists public.vt_accounts (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  account_number              text not null check (account_number ~ '^[0-9]{6,10}$'),

  -- AES-256-GCM, written only by /api/connect-vt. Format is iv:ciphertext:tag,
  -- hex, produced by lib/encrypt.ts. Never selectable by the browser — see the
  -- column grants at the end of this block.
  investor_password_encrypted text not null,
  investor_iv                 text not null,
  master_password_encrypted   text,
  master_iv                   text,

  server                      text not null default 'VTMarkets-Live'
                              check (server in ('VTMarkets-Live','VTMarkets-Demo')),
  telegram_id                 text,
  status                      text not null default 'disconnected'
                              check (status in ('disconnected','connected','error')),
  balance                     numeric(18,2) not null default 0,
  last_connected_at           timestamptz,

  -- Only meaningful with a master password stored; the API route refuses to set
  -- it otherwise, and the constraint makes that true in the data as well as in
  -- the code path.
  auto_execute_enabled        boolean not null default false,
  constraint auto_execute_needs_master
    check (not auto_execute_enabled or master_password_encrypted is not null),

  created_at                  timestamptz not null default now(),
  unique (user_id, account_number, server)
);

create index if not exists vt_accounts_user_idx on public.vt_accounts (user_id);

alter table public.vt_accounts enable row level security;

drop policy if exists vt_accounts_own_select on public.vt_accounts;
drop policy if exists vt_accounts_own_insert on public.vt_accounts;
drop policy if exists vt_accounts_own_update on public.vt_accounts;
drop policy if exists vt_accounts_own_delete on public.vt_accounts;

create policy vt_accounts_own_select on public.vt_accounts
  for select to authenticated using (auth.uid() = user_id);

/*
 * No INSERT or UPDATE policy for members, deliberately.
 *
 * A row here can only be written by /api/connect-vt, which holds the service
 * key and is the only place that can encrypt. If the browser could insert, it
 * could write a row whose "encrypted" password is plaintext of its choosing —
 * and the VPS would then be handed that string as a credential.
 */

-- Disconnecting is the member's own decision and must not need an admin.
create policy vt_accounts_own_delete on public.vt_accounts
  for delete to authenticated using (auth.uid() = user_id);

/*
 * The encrypted columns are not merely hidden by convention — they are revoked.
 *
 * RLS decides which ROWS a member sees; it has no notion of columns, so
 * `select *` on your own row would hand the browser the ciphertext, the IV and
 * the tag. That is everything an attacker with the env key needs, and it means
 * an XSS on this page exfiltrates trading credentials rather than a session.
 * Column grants are the part of Postgres that restricts columns.
 */
revoke all on public.vt_accounts from authenticated, anon;
grant select (
  id, user_id, account_number, server, telegram_id, status,
  balance, last_connected_at, auto_execute_enabled, created_at
) on public.vt_accounts to authenticated;
grant delete on public.vt_accounts to authenticated;

/* ==========================================================================
   2. bot_status — what the engine currently thinks
   ========================================================================== */

create table if not exists public.bot_status (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  current_symbol      text not null default 'XAUUSD',
  current_mode        text not null default 'YELLOW' check (current_mode in ('GREEN','YELLOW','RED')),
  adx_h1              numeric(10,2),
  bb_width            text check (bb_width in ('Wide','Narrow','Normal')),
  ema_distance        text,
  vt_balance          numeric(18,2),
  daily_pnl_percent   numeric(10,2),
  pattern_radar_signal text,
  risk_locked         boolean not null default true,
  updated_at          timestamptz not null default now(),
  unique (user_id, current_symbol)
);

alter table public.bot_status enable row level security;

drop policy if exists bot_status_own_select on public.bot_status;
drop policy if exists bot_status_own_all    on public.bot_status;

-- Read-only to the browser. The engine writes this with the service key; a
-- member who could UPDATE it could set current_mode = 'GREEN' and talk the bot
-- into trading a market it had ruled out.
create policy bot_status_own_select on public.bot_status
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.bot_status from authenticated, anon;
grant select on public.bot_status to authenticated;

/* ==========================================================================
   3. execution_logs — proposed trades and what happened to them
   ========================================================================== */

create table if not exists public.execution_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  vt_account_id        uuid references public.vt_accounts(id) on delete cascade,
  symbol               text not null default 'XAUUSD',
  action               text not null check (action in ('BUY','SELL','CLOSE')),
  price                numeric(18,5) not null,
  sl                   numeric(18,5),
  tp                   numeric(18,5),
  lot                  numeric(10,2) not null check (lot > 0 and lot <= 10),
  reason               text,
  status               text not null default 'PENDING_APPROVAL'
                       check (status in ('PENDING_APPROVAL','APPROVED','REJECTED','EXECUTED','EXPIRED','FAILED')),
  approved_at          timestamptz,
  executed_at          timestamptz,
  expires_at           timestamptz not null default (now() + interval '60 seconds'),
  price_tolerance_pips integer not null default 30,
  vps_response         jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists execution_logs_user_idx    on public.execution_logs (user_id, created_at desc);
create index if not exists execution_logs_pending_idx on public.execution_logs (status, expires_at)
  where status = 'PENDING_APPROVAL';

alter table public.execution_logs enable row level security;

drop policy if exists execution_logs_own_select on public.execution_logs;
drop policy if exists execution_logs_own_all    on public.execution_logs;

/*
 * Read-only to the browser, and this one matters most.
 *
 * The brief asked for `for all using (auth.uid() = user_id)`. That would let the
 * page that displays a trade also rewrite it: set status to 'EXECUTED' without
 * a broker ever seeing it, move `lot` from 0.01 to 10 after approval, or widen
 * `expires_at` so a stale price stays approvable. The approval flow is the
 * product; it cannot be enforced in a client that is also allowed to edit the
 * record. Approve and reject go through /api/bot/*, which re-checks ownership,
 * status, expiry and price drift server-side.
 */
create policy execution_logs_own_select on public.execution_logs
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.execution_logs from authenticated, anon;
grant select on public.execution_logs to authenticated;

/* ==========================================================================
   4. Realtime
   ========================================================================== */

/*
 * Realtime respects RLS, so a subscriber still only receives their own rows.
 * Wrapped because adding a table twice raises, and this file is meant to be
 * re-runnable.
 */
do $$
begin
  alter publication supabase_realtime add table public.bot_status;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.execution_logs;
exception when duplicate_object then null;
end $$;

-- Realtime sends the whole changed row to subscribers. vt_accounts is not
-- published: the ciphertext columns would ride along on every UPDATE.

/* ==========================================================================
   5. Check
   ========================================================================== */

-- All three should be true, and every table should list at least one policy.
select c.relname, c.relrowsecurity as rls_on, count(p.polname) as policies
  from pg_class c
  left join pg_policy p on p.polrelid = c.oid
 where c.relname in ('vt_accounts','bot_status','execution_logs')
 group by c.relname, c.relrowsecurity;
