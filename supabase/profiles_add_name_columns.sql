-- Names on the member profile.
--
-- Every profile in the app rendered "Renmar Sombilon" because the name was a
-- demo constant in src/lib/content.ts, not a column — there was nowhere for a
-- member's own name to live. These three columns are that place.
--
-- Nullable on purpose: rows created before this migration have no name, and the
-- app falls back to the address rather than refusing to render them. Run this
-- once in the Supabase SQL editor; it is idempotent.

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists first_name   text;
alter table public.profiles add column if not exists last_name    text;

-- Backfill nothing. A guessed name is worse than no name: the app derives a
-- readable label from the address when these are null, and that derivation
-- stays visibly a fallback instead of being frozen into the row as if the
-- member had typed it.

/*
 * The insert policy is unchanged and still governs these columns.
 *
 *   with check (auth.uid() = id and status = 'pending')
 *
 * A registrant may set their own name — that is the point — but the check on
 * `status` continues to hold, so writing a name cannot smuggle in an access
 * level alongside it. Do not widen this policy to add an UPDATE for names
 * without excluding the status column.
 */

/*
 * Letting a member edit their own name — and nothing else.
 *
 * An RLS policy cannot restrict which columns an UPDATE touches, so a plain
 * "update own profile" policy would also let a member set their own status to
 * 'approved' straight from the browser. Column-level GRANTs are the part of
 * Postgres that does restrict columns, and they are checked independently of
 * RLS: with UPDATE revoked on the table and granted on three named columns,
 * `update profiles set status = 'approved'` is refused no matter what the
 * policy says.
 *
 * Both layers are required. Remove either one and the gate opens.
 */
revoke update on public.profiles from authenticated;
grant  update (display_name, first_name, last_name) on public.profiles to authenticated;

drop policy if exists "update own name" on public.profiles;
create policy "update own name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
