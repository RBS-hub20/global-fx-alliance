-- URGENT — run this before anything else.
--
-- Measured on the live project on 2026-09-10 using the public anon key, which
-- ships inside the browser bundle and is readable by anyone who opens devtools:
--
--   * SELECT returned every row of verified_users — member emails, trading
--     account numbers and brokers.
--   * INSERT accepted a new row with status = 'verified'.
--   * UPDATE promoted an existing row to 'verified' (HTTP 204).
--
-- So the deposit gate could be walked past by anyone, and the member list was
-- public. RLS was never enabled on this table: shoutbox and user_streaks both
-- returned [] to the same key, which is what a protected table looks like.
--
-- Enabling RLS with no policies denies every anon and authenticated request.
-- The API routes use the service-role key, which bypasses RLS, so they keep
-- working untouched.

alter table public.verified_users enable row level security;

-- Remove any permissive policy that may already exist. A policy written
-- `for all using (true)` names no role, so it applies to anon as well and would
-- undo the line above.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'verified_users'
  loop
    execute format('drop policy %I on public.verified_users', p.policyname);
  end loop;
end $$;

-- Belt and braces for the other member tables.
alter table if exists public.shoutbox     enable row level security;
alter table if exists public.user_streaks enable row level security;

-- Verify afterwards — every one of these should come back true:
--   select relname, relrowsecurity from pg_class
--    where relname in ('verified_users','shoutbox','user_streaks','profiles');
