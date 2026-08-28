create table if not exists public.intelligence_api_rate_state (
  client_id uuid primary key references public.intelligence_api_clients(id) on delete cascade,
  minute_window timestamptz not null,
  minute_count integer not null default 0,
  day_window date not null,
  day_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint intelligence_api_rate_state_minute_count_check check (minute_count >= 0),
  constraint intelligence_api_rate_state_day_count_check check (day_count >= 0)
);

alter table public.intelligence_api_rate_state enable row level security;
revoke all on public.intelligence_api_rate_state from public, anon, authenticated;
grant all on public.intelligence_api_rate_state to service_role;

create or replace function public.consume_intelligence_api_quota(p_client_id uuid)
returns table (
  allowed boolean,
  minute_remaining integer,
  daily_remaining integer,
  retry_after_seconds integer,
  reason text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_window timestamptz := date_trunc('minute', v_now);
  v_day_window date := (v_now at time zone 'UTC')::date;
  v_minute_limit integer;
  v_daily_limit integer;
  v_state public.intelligence_api_rate_state%rowtype;
  v_retry integer := 0;
begin
  select c.rate_limit_per_minute, c.daily_limit
    into v_minute_limit, v_daily_limit
  from public.intelligence_api_clients c
  where c.id = p_client_id
    and c.enabled = true
    and (c.expires_at is null or c.expires_at > v_now);

  if not found then
    return query select false, 0, 0, 60, 'client_unavailable'::text;
    return;
  end if;

  insert into public.intelligence_api_rate_state (
    client_id, minute_window, minute_count, day_window, day_count, updated_at
  ) values (
    p_client_id, v_minute_window, 0, v_day_window, 0, v_now
  ) on conflict (client_id) do nothing;

  select * into v_state
  from public.intelligence_api_rate_state
  where client_id = p_client_id
  for update;

  if v_state.minute_window <> v_minute_window then
    v_state.minute_window := v_minute_window;
    v_state.minute_count := 0;
  end if;

  if v_state.day_window <> v_day_window then
    v_state.day_window := v_day_window;
    v_state.day_count := 0;
  end if;

  if v_state.minute_count >= v_minute_limit then
    v_retry := greatest(1, ceil(extract(epoch from ((v_state.minute_window + interval '1 minute') - v_now)))::integer);
    update public.intelligence_api_rate_state
      set minute_window = v_state.minute_window,
          minute_count = v_state.minute_count,
          day_window = v_state.day_window,
          day_count = v_state.day_count,
          updated_at = v_now
    where client_id = p_client_id;
    return query select false,
      greatest(0, v_minute_limit - v_state.minute_count),
      greatest(0, v_daily_limit - v_state.day_count),
      v_retry,
      'minute_limit'::text;
    return;
  end if;

  if v_state.day_count >= v_daily_limit then
    v_retry := greatest(1, ceil(extract(epoch from (((v_day_window + 1)::timestamp at time zone 'UTC') - v_now)))::integer);
    update public.intelligence_api_rate_state
      set minute_window = v_state.minute_window,
          minute_count = v_state.minute_count,
          day_window = v_state.day_window,
          day_count = v_state.day_count,
          updated_at = v_now
    where client_id = p_client_id;
    return query select false,
      greatest(0, v_minute_limit - v_state.minute_count),
      0,
      v_retry,
      'daily_limit'::text;
    return;
  end if;

  v_state.minute_count := v_state.minute_count + 1;
  v_state.day_count := v_state.day_count + 1;

  update public.intelligence_api_rate_state
    set minute_window = v_state.minute_window,
        minute_count = v_state.minute_count,
        day_window = v_state.day_window,
        day_count = v_state.day_count,
        updated_at = v_now
  where client_id = p_client_id;

  return query select true,
    greatest(0, v_minute_limit - v_state.minute_count),
    greatest(0, v_daily_limit - v_state.day_count),
    0,
    'allowed'::text;
end;
$$;

revoke all on function public.consume_intelligence_api_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_intelligence_api_quota(uuid) to service_role;

comment on table public.intelligence_api_rate_state is
  'Backend-only bounded rate-limit state for BCC Intelligence API clients.';
comment on function public.consume_intelligence_api_quota(uuid) is
  'Atomically consumes one Intelligence API request quota for a backend-authenticated client.';;
