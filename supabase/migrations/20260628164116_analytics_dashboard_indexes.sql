create index if not exists analytics_events_public_event_created_idx
on public.analytics_events (event_name, created_at desc)
where coalesce(is_internal, false) = false;

create index if not exists analytics_events_public_visitor_created_idx
on public.analytics_events (visitor_id, created_at desc)
where coalesce(is_internal, false) = false;

create index if not exists analytics_events_internal_event_created_idx
on public.analytics_events (event_name, created_at desc)
where coalesce(is_internal, false) = true;;
