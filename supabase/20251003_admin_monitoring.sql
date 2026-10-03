-- Monitoring and CRM tables behind /admin.
--
-- Run after the earlier migrations. Idempotent; safe to run repeatedly.
--
-- Why these exist: before this file the admin console had nothing to read. The
-- brief described "real-time visitors from the middleware log" and "the live
-- feed from crm_leads + request logs", but this repo kept no request log and had
-- no crm_leads table — Vercel Analytics and the Meta Pixel both send their
-- numbers somewhere else and neither can be queried back out. So the console
-- either had to invent figures or get a first-party store of its own. This is
-- the store.
--
-- Both tables have row-level security on with no policy at all. That is the
-- same pattern verified_users uses: the service-role key bypasses RLS, and
-- nothing else should ever reach these rows. Visitor and lead records are the
-- most sensitive data in the project after the deposit proofs.

/* ================================================== 1. first-party traffic */

/*
 * One row per counted event on the public funnel pages.
 *
 * Deliberately not a request log: no IP address, no user agent string, no full
 * referrer and no query string. What a monitoring dashboard needs is which page,
 * which campaign, roughly where and roughly what device — none of which requires
 * keeping anything that identifies a person.
 *
 * `visitor` is sha256(ip + user agent + salt + today's date) truncated. It makes
 * "unique visitors today" countable and "who was this" uncountable, and because
 * the date is inside the hash it stops being a usable identifier at midnight UTC.
 */
create table if not exists public.site_events (
  id            bigint generated always as identity primary key,
  event         text not null check (event in ('page_view','lead')),
  path          text not null,
  visitor       text not null,
  country       text,
  device        text check (device in ('mobile','tablet','desktop')),
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  -- The Telegram deep-link payload the CTA sent, e.g. join_page_Gold_Ideas_Video1.
  -- This is what ties a click here to a /start over in the bot.
  start_param   text,
  created_at    timestamptz not null default now()
);

create index if not exists site_events_time_idx     on public.site_events (created_at desc);
create index if not exists site_events_event_idx    on public.site_events (event, created_at desc);
create index if not exists site_events_visitor_idx  on public.site_events (visitor, created_at desc);
create index if not exists site_events_campaign_idx on public.site_events (utm_campaign, created_at desc);

alter table public.site_events enable row level security;

/* ============================================================== 2. the CRM */

/*
 * One row per person who reached the access bot.
 *
 * Nothing in this repo writes to it yet. The bot at @gfxa_access_bot is hosted
 * elsewhere and this project has no /api/telegram/webhook — until one exists,
 * every stage of the funnel from "/start" onward reads zero, and the console
 * says so on the page rather than showing a confident 0% conversion.
 *
 * `status` is a ladder, not a set of flags: each value implies the ones before
 * it, which is what lets the funnel counts be a single range scan.
 */
create table if not exists public.crm_leads (
  id                uuid primary key default gen_random_uuid(),
  -- Telegram's numeric id, which is stable where @username is not.
  telegram_id       bigint unique,
  telegram_username text,
  name              text,
  phone             text,
  country           text,
  experience        text,
  goal              text,
  -- The start payload, so a lead is attributable to the ad that produced it.
  start_param       text,
  utm_source        text,
  utm_campaign      text,
  utm_content       text,
  status            text not null default 'started'
                    check (status in ('started','completed_quiz','joined_channel','contacted','verified')),
  note              text,
  contacted_at      timestamptz,
  joined_channel_at timestamptz,
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists crm_leads_time_idx     on public.crm_leads (created_at desc);
create index if not exists crm_leads_status_idx   on public.crm_leads (status, created_at desc);
create index if not exists crm_leads_campaign_idx on public.crm_leads (utm_campaign, created_at desc);
create index if not exists crm_leads_source_idx   on public.crm_leads (start_param);

alter table public.crm_leads enable row level security;

-- Keeps updated_at honest without the API having to remember to send it.
create or replace function public.crm_leads_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists crm_leads_touch_trg on public.crm_leads;
create trigger crm_leads_touch_trg before update on public.crm_leads
  for each row execute function public.crm_leads_touch();

/* ---------------------------------------------------------------- retention */

/*
 * Visitor rows are only useful while they are recent. Call this from a cron, or
 * run it by hand now and then — the console does not depend on old rows.
 */
create or replace function public.prune_site_events(keep_days integer default 90)
returns integer language plpgsql security definer set search_path = public as $$
declare removed integer;
begin
  delete from public.site_events where created_at < now() - (keep_days || ' days')::interval;
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function public.prune_site_events(integer) from public, anon, authenticated;
