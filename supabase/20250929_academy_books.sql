-- Academy: five books, forty lessons, page images behind a private bucket.
--
-- Run after the earlier migrations. Idempotent.
--
-- What this can and cannot enforce, stated once so the product copy does not
-- overstate it: a page a member can see is a page their browser has decoded,
-- and anything on screen can be photographed. Blocking right-click and Ctrl+S
-- is a speed bump. The controls that actually matter are here: the bucket is
-- private, URLs are signed for 60 seconds by an API route that checks the
-- session, every view is logged, and every page is watermarked with the
-- member's own identity — so a leaked screenshot says who leaked it.

/* ========================================================== 1. the library */

create table if not exists public.academy_books (
  id            uuid primary key default gen_random_uuid(),
  book_number   smallint not null unique check (book_number between 1 and 20),
  title         text not null,
  slug          text not null unique,
  description   text,
  emoji         text,
  total_pages   integer not null default 0,
  total_lessons integer not null default 0,
  cover_path    text,
  created_at    timestamptz not null default now()
);

create table if not exists public.academy_lessons (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.academy_books(id) on delete cascade,
  lesson_number smallint not null unique check (lesson_number between 1 and 200),
  book_lesson   smallint not null,
  track         text not null check (track in ('FOUNDATION','INTERMEDIATE','ADVANCED')),
  track_number  smallint not null check (track_number between 1 and 3),
  title         text not null,
  topic         text,
  slug          text not null unique,
  first_page    integer,
  last_page     integer,
  created_at    timestamptz not null default now()
);

create index if not exists academy_lessons_track_idx on public.academy_lessons (track, lesson_number);
create index if not exists academy_lessons_book_idx  on public.academy_lessons (book_id, book_lesson);

/*
 * One row per page image. `object_path` is a key inside the private bucket,
 * never a URL — a URL in a table is a URL that leaks with the table.
 */
create table if not exists public.academy_pages (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.academy_lessons(id) on delete cascade,
  page_number  integer not null check (page_number > 0),
  content_type text not null default 'image' check (content_type in ('image','text')),
  object_path  text,
  body         text,
  created_at   timestamptz not null default now(),
  unique (lesson_id, page_number)
);

/* ========================================================= 2. per member */

create table if not exists public.academy_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  lesson_id        uuid not null references public.academy_lessons(id) on delete cascade,
  is_complete      boolean not null default false,
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  viewed_pages     integer[] not null default '{}',
  last_page        integer not null default 1,
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Who opened which page, and when. Written by the API with the service key.
create table if not exists public.academy_views (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  lesson_id   uuid references public.academy_lessons(id) on delete set null,
  page_number integer,
  viewed_at   timestamptz not null default now()
);

create index if not exists academy_views_user_idx on public.academy_views (user_id, viewed_at desc);

/* ============================================================== 3. access */

alter table public.academy_books    enable row level security;
alter table public.academy_lessons  enable row level security;
alter table public.academy_pages    enable row level security;
alter table public.academy_progress enable row level security;
alter table public.academy_views    enable row level security;

drop policy if exists academy_books_read    on public.academy_books;
drop policy if exists academy_lessons_read  on public.academy_lessons;
drop policy if exists academy_progress_own  on public.academy_progress;
drop policy if exists academy_progress_ins  on public.academy_progress;
drop policy if exists academy_progress_upd  on public.academy_progress;

/*
 * The catalogue is readable by approved members only — the real membership
 * gate, profiles.status, not the "2,480 Rep" on the sidebar card, which is a
 * fixture showing the same number to everyone.
 */
create policy academy_books_read on public.academy_books
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved'));

create policy academy_lessons_read on public.academy_lessons
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved'));

/*
 * academy_pages and academy_views deliberately get RLS with no policy at all:
 * with RLS on and nothing granted, every browser request is refused and only
 * the service key can read them. Page paths are handed out one signed URL at a
 * time by /api/academy/page, which checks the session first.
 */

create policy academy_progress_own on public.academy_progress
  for select to authenticated using (auth.uid() = user_id);
create policy academy_progress_ins on public.academy_progress
  for insert to authenticated with check (auth.uid() = user_id);
create policy academy_progress_upd on public.academy_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.academy_pages, public.academy_views from anon, authenticated;
grant select on public.academy_books, public.academy_lessons to authenticated;
grant select, insert, update on public.academy_progress to authenticated;

/* ============================================================= 4. storage */

-- Private bucket. No policies on storage.objects for it, so only the service
-- key can read or write: the browser never touches the bucket directly.
insert into storage.buckets (id, name, public)
values ('academy-books', 'academy-books', false)
on conflict (id) do update set public = false;

/* ================================================================ 5. seed */

insert into public.academy_books (book_number, title, slug, description, emoji, total_lessons) values
  (1, 'Forex From Zero',                  'forex-from-zero',      'Currencies, pips, lots, leverage, sessions, brokers, MT5 and order types.', '📘', 12),
  (2, 'The Candlestick Handbook',         'candlestick-handbook', 'Candlestick patterns read on real charts.',                                 '🕯', 8),
  (3, 'Market Structure Mastery',         'market-structure',     'Trend, break of structure, change of character.',                           '📊', 7),
  (4, 'Liquidity & Price Action',         'liquidity-price-action','Liquidity sweeps, displacement and price action.',                          '💧', 7),
  (5, 'The GFXA Trading Strategy Playbook','strategy-playbook',   'Build it, test it, execute it, journal it, improve it.',                     '🎯', 6)
on conflict (book_number) do update
  set title = excluded.title, slug = excluded.slug, description = excluded.description,
      emoji = excluded.emoji, total_lessons = excluded.total_lessons;

/*
 * Forty lessons, numbered across the whole curriculum, mapped onto the three
 * tracks already on screen: 12 / 18 / 10. Book 04 is the bridge — its first
 * three lessons close Track 02 and the rest open Track 03, which is what makes
 * the existing counts add up.
 */
with b as (select id, book_number from public.academy_books),
seed(book_number, book_lesson, track, track_number, title, topic) as (values
  (1,1 ,'FOUNDATION',1,'What the Forex market is','market'),
  (1,2 ,'FOUNDATION',1,'Currencies and pairs','currencies'),
  (1,3 ,'FOUNDATION',1,'Reading a quote','quotes'),
  (1,4 ,'FOUNDATION',1,'Pips and points','pips'),
  (1,5 ,'FOUNDATION',1,'Lots and position size','lots'),
  (1,6 ,'FOUNDATION',1,'Leverage and margin','leverage'),
  (1,7 ,'FOUNDATION',1,'Trading sessions','sessions'),
  (1,8 ,'FOUNDATION',1,'Spread, swap and commission','costs'),
  (1,9 ,'FOUNDATION',1,'Choosing a broker','brokers'),
  (1,10,'FOUNDATION',1,'Setting up MT5','mt5'),
  (1,11,'FOUNDATION',1,'Order types','orders'),
  (1,12,'FOUNDATION',1,'Your first demo trade','first-trade'),
  (2,1 ,'INTERMEDIATE',2,'Anatomy of a candle','candles'),
  (2,2 ,'INTERMEDIATE',2,'Doji and indecision','doji'),
  (2,3 ,'INTERMEDIATE',2,'Engulfing patterns','engulfing'),
  (2,4 ,'INTERMEDIATE',2,'Pin bars and rejection','pin-bars'),
  (2,5 ,'INTERMEDIATE',2,'Inside and outside bars','inside-bars'),
  (2,6 ,'INTERMEDIATE',2,'Continuation patterns','continuation'),
  (2,7 ,'INTERMEDIATE',2,'Reading candles in context','context'),
  (2,8 ,'INTERMEDIATE',2,'Common candlestick traps','traps'),
  (3,1 ,'INTERMEDIATE',2,'What market structure is','structure'),
  (3,2 ,'INTERMEDIATE',2,'Highs, lows and swings','swings'),
  (3,3 ,'INTERMEDIATE',2,'Trend, range and transition','trend'),
  (3,4 ,'INTERMEDIATE',2,'Break of structure','bos'),
  (3,5 ,'INTERMEDIATE',2,'Change of character','choch'),
  (3,6 ,'INTERMEDIATE',2,'Supply and demand zones','zones'),
  (3,7 ,'INTERMEDIATE',2,'Multi-timeframe structure','mtf'),
  (4,1 ,'INTERMEDIATE',2,'What liquidity is','liquidity'),
  (4,2 ,'INTERMEDIATE',2,'Where stops rest','stops'),
  (4,3 ,'INTERMEDIATE',2,'Liquidity sweeps','sweeps'),
  (4,4 ,'ADVANCED',3,'Displacement','displacement'),
  (4,5 ,'ADVANCED',3,'Fair value gaps','fvg'),
  (4,6 ,'ADVANCED',3,'Order blocks','order-blocks'),
  (4,7 ,'ADVANCED',3,'Putting price action together','price-action'),
  (5,1 ,'ADVANCED',3,'Building a strategy','build'),
  (5,2 ,'ADVANCED',3,'Entry, stop and target','entries'),
  (5,3 ,'ADVANCED',3,'Risk per trade','risk'),
  (5,4 ,'ADVANCED',3,'Backtesting honestly','backtest'),
  (5,5 ,'ADVANCED',3,'Journaling and review','journal'),
  (5,6 ,'ADVANCED',3,'Execution and discipline','execution')
)
insert into public.academy_lessons (book_id, lesson_number, book_lesson, track, track_number, title, topic, slug)
select b.id,
       row_number() over (order by s.book_number, s.book_lesson)::smallint,
       s.book_lesson, s.track, s.track_number, s.title, s.topic,
       s.topic || '-' || s.book_number || '-' || s.book_lesson
from seed s join b on b.book_number = s.book_number
on conflict (slug) do nothing;

/* ================================================================ check */

select b.book_number, b.title, b.total_lessons, count(l.id) as seeded_lessons
  from public.academy_books b
  left join public.academy_lessons l on l.book_id = b.id
 group by b.book_number, b.title, b.total_lessons
 order by b.book_number;

select track, count(*) from public.academy_lessons group by track order by track;
