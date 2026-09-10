-- Adds the audit columns to a profiles table created from the earlier schema.
--
-- Without these, approving raised "Could not find the 'note' column of
-- 'profiles' in the schema cache" and the member stayed pending. The admin route
-- now drops whichever of these is missing and still records the decision, so
-- this is a repair rather than a prerequisite.
--
-- Idempotent; safe to run repeatedly.

alter table public.profiles add column if not exists reviewed_at timestamptz;
alter table public.profiles add column if not exists note        text;

-- Ask PostgREST to notice them immediately instead of at its next refresh.
notify pgrst, 'reload schema';
