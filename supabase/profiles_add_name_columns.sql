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
 * Making those columns writable from the browser moved to
 * supabase/profiles_allow_own_update.sql, which grants the same three plus bio,
 * country and trading_style and adds the escalation trigger. Run that file; the
 * grant and policy that used to sit here would narrow it back to three columns.
 */
