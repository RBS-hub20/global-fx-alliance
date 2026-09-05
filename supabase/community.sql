-- GFXA Chat repair.
--
-- Fixes "Could not find the 'handle' column of 'shoutbox' in the schema cache",
-- which happens when the table was created from an earlier schema, or when
-- PostgREST has not yet noticed a column that was added after it cached.
--
-- The application no longer depends on this column — the handle is derived from
-- the email on every read — so running this is an improvement, not a
-- prerequisite. Idempotent; safe to run repeatedly.

alter table public.shoutbox add column if not exists handle text;

-- Backfill to match what the app derives: FNV-1a over the lowercased address,
-- base36, last six characters. Postgres has no FNV, so existing rows get a
-- stable md5-based handle instead; new rows are written by the app itself and
-- nothing reads either, so the two never have to agree.
update public.shoutbox
   set handle = 'trader-' || substr(md5(lower(trim(email))), 1, 6)
 where handle is null;

create index if not exists idx_shoutbox_created on public.shoutbox (created_at desc);

-- RLS on with no policies: the service-role key the API uses bypasses RLS, and
-- a policy written `for all using (true)` would hand the anon key every member's
-- email and the ability to post as anyone.
alter table public.shoutbox enable row level security;
drop policy if exists "Allow service role all" on public.shoutbox;

-- Ask PostgREST to reload, so a freshly added column is visible immediately
-- rather than after its next scheduled refresh.
notify pgrst, 'reload schema';
