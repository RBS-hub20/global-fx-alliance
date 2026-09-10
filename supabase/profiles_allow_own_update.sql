-- Let a member edit their own profile — and only the parts that are theirs.
--
-- Supersedes the grant/policy block at the end of
-- supabase/profiles_add_name_columns.sql: it names the same policy work plus
-- the three columns the edit form needs, so running this file is enough.
-- Idempotent; safe to run repeatedly.

-- ---------------------------------------------------------------- columns ---
-- The edit form offers bio, country and trading style. None of them existed, so
-- every save of those fields was written to component state and lost on reload.
alter table public.profiles add column if not exists bio           text;
alter table public.profiles add column if not exists country       text;
alter table public.profiles add column if not exists trading_style text;
alter table public.profiles add column if not exists updated_at    timestamptz not null default now();

-- ----------------------------------------------------------------- policy ---
drop policy if exists "update own name"           on public.profiles;
drop policy if exists "Allow own profile update"  on public.profiles;

create policy "Allow own profile update"
  on public.profiles for update
  to authenticated
  using      (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------- grants ---
/*
 * The policy above says WHICH ROW. It cannot say which COLUMNS: RLS has no
 * notion of a column list, so this policy on its own would also let a member
 * run `update profiles set status = 'approved' where id = auth.uid()` straight
 * from the browser with the anon key. That is the whole gate, gone.
 *
 * Column-level GRANTs are the part of Postgres that does restrict columns, and
 * they are checked independently of RLS. With UPDATE revoked on the table and
 * granted on six named columns, an update naming `status` is refused outright —
 * before any policy or trigger is consulted.
 */
revoke update on public.profiles from authenticated, anon;
grant  update (display_name, first_name, last_name, bio, country, trading_style)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------- trigger ---
/*
 * Second layer, and a deliberate one: the grants above are the barrier, this is
 * what still holds if someone later runs a broad `grant update on profiles`
 * while debugging and forgets to put it back.
 *
 * Scoped to the two roles that reach the database from a browser. `auth.role()`
 * is null in a direct SQL-editor session and 'service_role' for the admin
 * routes, and `null in (...)` is null rather than true — so neither an admin
 * fixing a row by hand nor /api/admin/approve is affected by this. Only the
 * browser is.
 */
create or replace function public.prevent_status_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() in ('authenticated', 'anon') then
    -- Reverted rather than raised. The grants already produce a hard error for
    -- these roles, so anything arriving here is not an honest mistake, and a
    -- silent no-op tells a prober nothing about what it failed to change.
    NEW.status         := OLD.status;
    NEW.email          := OLD.email;
    NEW.account_number := OLD.account_number;
    NEW.id             := OLD.id;
    NEW.created_at     := OLD.created_at;
    NEW.reviewed_at    := OLD.reviewed_at;
    NEW.note           := OLD.note;
  end if;

  NEW.updated_at := now();
  return NEW;
end $$;

drop trigger if exists trg_prevent_status_escalation on public.profiles;
create trigger trg_prevent_status_escalation
  before update on public.profiles
  for each row execute function public.prevent_status_escalation();

-- ------------------------------------------------------------------ check ---
-- Should list exactly: display_name, first_name, last_name, bio, country,
-- trading_style. Anything else in this result is a way into the account gate.
select column_name
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name   = 'profiles'
   and grantee      = 'authenticated'
   and privilege_type = 'UPDATE'
 order by column_name;
