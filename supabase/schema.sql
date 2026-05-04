create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'event_status'
  ) then
    create type public.event_status as enum ('draft', 'published', 'cancelled');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'event_tone'
  ) then
    create type public.event_tone as enum ('violet', 'coral', 'sky', 'amber', 'teal');
  end if;
end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  start_date date not null,
  end_date date,
  place text not null,
  city text not null,
  external_url text,
  comment text,
  tone public.event_tone not null default 'sky',
  status public.event_status not null default 'draft',
  registration_deadline date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_date_check check (end_date is null or end_date >= start_date)
);

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table if not exists public.event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_username text,
  notify_24h boolean not null default true,
  notify_3h boolean not null default true,
  last_reminder_24h_at timestamptz,
  last_reminder_3h_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, telegram_user_id)
);

create index if not exists events_start_date_idx on public.events(start_date);
create index if not exists events_status_idx on public.events(status);
create index if not exists event_subscriptions_event_id_idx on public.event_subscriptions(event_id);
create index if not exists event_subscriptions_user_id_idx on public.event_subscriptions(telegram_user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.event_subscriptions enable row level security;
alter table public.admins enable row level security;

drop policy if exists "Published events are readable by everyone" on public.events;
create policy "Published events are readable by everyone"
on public.events
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "No direct subscription access for anon users" on public.event_subscriptions;
create policy "No direct subscription access for anon users"
on public.event_subscriptions
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct admins access for anon users" on public.admins;
create policy "No direct admins access for anon users"
on public.admins
for all
to anon, authenticated
using (false)
with check (false);
