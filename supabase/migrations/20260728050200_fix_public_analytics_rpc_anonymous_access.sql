-- The public analytics endpoint is intentionally callable by anonymous visitors.
-- Keep private schema hidden and delegate through a narrowly scoped wrapper.
create or replace function public.record_analytics_event(
  event_name text,
  session_id text,
  visitor_id text,
  page_path text,
  page_url text,
  page_title text,
  page_lang text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb,
  event_source text
)
returns void
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.record_analytics_event(
    event_name,
    session_id,
    visitor_id,
    page_path,
    page_url,
    page_title,
    page_lang,
    referrer_host,
    utm_source,
    utm_medium,
    utm_campaign,
    metadata,
    event_source
  );
$$;

revoke all on function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated;;
