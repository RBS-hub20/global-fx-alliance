-- Chapter membership, so joining one means something.
--
-- Run after the earlier migrations. Idempotent; safe to run repeatedly.
--
-- Until now "joined" lived in localStorage: it did not survive a different
-- device, nobody else could see it, and the member counts on the cards were
-- constants in the source. This is the table that makes both real.
--
-- Worth saying plainly before it is run: the counts will drop. 342 members in
-- Manila becomes however many people have actually joined, which on day one is
-- close to none. That is the point of running it.

create table if not exists public.chapter_members (
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- ISO 3166-1 alpha-2, matching the chapter codes in the panel.
  chapter_code text not null check (chapter_code ~ '^[A-Z]{2}$'),
  joined_at    timestamptz not null default now(),
  primary key (user_id, chapter_code)
);

create index if not exists chapter_members_code_idx on public.chapter_members (chapter_code, joined_at desc);

alter table public.chapter_members enable row level security;

drop policy if exists chapter_members_read_own on public.chapter_members;

-- A member sees their own memberships. Everyone else's are counted for them by
-- /api/chapters, which returns totals rather than a list of who is in what —
-- a membership list is the kind of thing that should not be readable just
-- because it is not secret.
create policy chapter_members_read_own
  on public.chapter_members for select
  to authenticated
  using (auth.uid() = user_id);

/*
 * No INSERT, UPDATE or DELETE policy for members.
 *
 * Joining is not a privilege, so a client-side insert would not be a security
 * hole — but keeping writes in /api/chapters means the chapter code is checked
 * against the real list in one place, and the counts cannot be inflated by
 * anyone willing to open devtools. Same reasoning as indicator_access.
 */
