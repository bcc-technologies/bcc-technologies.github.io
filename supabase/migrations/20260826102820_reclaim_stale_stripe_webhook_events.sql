-- Stripe retries webhook deliveries, but a worker can terminate after claiming an
-- event and before recording completion. Treat `processing` as a renewable lease
-- so an abandoned event is retried without allowing concurrent active workers.
-- Ten minutes is intentionally longer than the Edge Function execution window.

create or replace function public.claim_stripe_webhook_event(p_event jsonb)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed_id text;
begin
  if jsonb_typeof(p_event) <> 'object'
     or coalesce(p_event->>'id', '') !~ '^evt_[A-Za-z0-9]+$' then
    raise exception 'A valid Stripe event ID is required';
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id,
    livemode,
    event_type,
    object_id,
    api_version,
    event_created_at,
    status,
    attempts,
    payload
  ) values (
    p_event->>'id',
    coalesce((p_event->>'livemode')::boolean, false),
    p_event->>'type',
    p_event#>>'{data,object,id}',
    p_event->>'api_version',
    to_timestamp((p_event->>'created')::double precision),
    'processing',
    1,
    p_event
  )
  on conflict (stripe_event_id) do nothing
  returning stripe_event_id into claimed_id;

  if claimed_id is not null then
    return 'claimed';
  end if;

  update public.stripe_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      last_error = null,
      processed_at = null,
      updated_at = now()
  where stripe_event_id = p_event->>'id'
    and (
      status = 'failed'
      or (
        status = 'processing'
        and updated_at < now() - interval '10 minutes'
      )
    )
  returning stripe_event_id into claimed_id;

  return case when claimed_id is null then 'duplicate' else 'claimed' end;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(jsonb) from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(jsonb) to service_role;

comment on function public.claim_stripe_webhook_event(jsonb) is
  'Atomically claims new, failed, or abandoned Stripe events; active and terminal events remain duplicates.';
