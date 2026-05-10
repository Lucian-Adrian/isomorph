create table if not exists public.diagrams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source text not null,
  canvas_state text,
  active_diagram_name text,
  line_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagrams_title_not_blank_check check (length(btrim(title)) > 0),
  constraint diagrams_line_count_matches_source_check check (
    line_count = array_length(regexp_split_to_array(source, E'\\r\\n|\\r|\\n'), 1)
  ),
  constraint diagrams_line_count_check check (line_count <= 1000)
);

create table if not exists public.telemetry_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  route text,
  device jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.telemetry_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid references public.telemetry_sessions(id) on delete set null,
  diagram_id uuid references public.diagrams(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists diagrams_set_updated_at on public.diagrams;
create trigger diagrams_set_updated_at
before update on public.diagrams
for each row
execute function public.set_updated_at();

create or replace function public.enforce_diagram_file_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*)
    from public.diagrams
    where user_id = new.user_id
  ) >= 20 then
    raise exception 'The demo limit is 20 saved files per user.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists diagrams_file_limit on public.diagrams;
create trigger diagrams_file_limit
before insert on public.diagrams
for each row
execute function public.enforce_diagram_file_limit();

alter table public.diagrams enable row level security;
alter table public.telemetry_sessions enable row level security;
alter table public.telemetry_events enable row level security;

create policy "diagrams_select_own" on public.diagrams for select using ((select auth.uid()) = user_id);
create policy "diagrams_insert_own" on public.diagrams for insert with check ((select auth.uid()) = user_id);
create policy "diagrams_update_own" on public.diagrams for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "diagrams_delete_own" on public.diagrams for delete using ((select auth.uid()) = user_id);

create policy "sessions_select_own" on public.telemetry_sessions for select using ((select auth.uid()) = user_id);
create policy "sessions_insert_own" on public.telemetry_sessions for insert with check ((select auth.uid()) = user_id or user_id is null);
create policy "sessions_update_own" on public.telemetry_sessions for update
using ((select auth.uid()) = user_id or user_id is null)
with check ((select auth.uid()) = user_id or user_id is null);

create policy "events_select_own" on public.telemetry_events for select using ((select auth.uid()) = user_id);
create policy "events_insert_own" on public.telemetry_events for insert with check ((select auth.uid()) = user_id or user_id is null);

create index if not exists diagrams_user_id_idx on public.diagrams(user_id);
create index if not exists diagrams_user_updated_at_idx on public.diagrams(user_id, updated_at desc);
create index if not exists diagrams_user_title_idx on public.diagrams(user_id, title);
create index if not exists diagrams_updated_at_idx on public.diagrams(updated_at desc);
create index if not exists telemetry_sessions_user_started_idx on public.telemetry_sessions(user_id, started_at desc);
create index if not exists telemetry_events_event_type_idx on public.telemetry_events(event_type);
create index if not exists telemetry_events_session_id_idx on public.telemetry_events(session_id);
create index if not exists telemetry_events_user_created_idx on public.telemetry_events(user_id, created_at desc);
