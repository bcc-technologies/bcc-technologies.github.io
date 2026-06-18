create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null check (char_length(btrim(event_name)) between 1 and 80),
  event_source text not null default 'frontend' check (event_source in ('frontend', 'plausible', 'system')),
  session_id text not null check (char_length(session_id) between 8 and 120),
  visitor_id text not null check (char_length(visitor_id) between 8 and 120),
  page_path text not null default '/' check (char_length(page_path) <= 240 and left(page_path, 1) = '/'),
  page_url text not null default '' check (char_length(page_url) <= 500),
  page_title text not null default '' check (char_length(page_title) <= 200),
  page_lang text not null default 'es' check (char_length(page_lang) between 2 and 10),
  referrer_host text not null default '' check (char_length(referrer_host) <= 160),
  utm_source text not null default '' check (char_length(utm_source) <= 120),
  utm_medium text not null default '' check (char_length(utm_medium) <= 120),
  utm_campaign text not null default '' check (char_length(utm_campaign) <= 120),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists analytics_events_created_at_idx
on public.analytics_events (created_at desc);

create index if not exists analytics_events_name_created_idx
on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_page_created_idx
on public.analytics_events (page_path, created_at desc);

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from public, anon, authenticated;
grant select on public.analytics_events to authenticated;

drop policy if exists "Admins read analytics events" on public.analytics_events;
create policy "Admins read analytics events"
on public.analytics_events
for select
to authenticated
using (private.is_admin());

create or replace function public.record_analytics_event(
  event_name text,
  session_id text,
  visitor_id text,
  page_path text default '/',
  page_url text default '',
  page_title text default '',
  page_lang text default 'es',
  referrer_host text default '',
  utm_source text default '',
  utm_medium text default '',
  utm_campaign text default '',
  metadata jsonb default '{}'::jsonb,
  event_source text default 'frontend'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_events (
    event_name,
    event_source,
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
    metadata
  )
  values (
    left(lower(trim(coalesce(event_name, ''))), 80),
    case
      when event_source in ('frontend', 'plausible', 'system') then event_source
      else 'frontend'
    end,
    left(trim(coalesce(session_id, 'session-missing')), 120),
    left(trim(coalesce(visitor_id, 'visitor-missing')), 120),
    case
      when left(trim(coalesce(page_path, '/')), 1) = '/' then left(trim(coalesce(page_path, '/')), 240)
      else '/'
    end,
    left(trim(coalesce(page_url, '')), 500),
    left(trim(coalesce(page_title, '')), 200),
    left(lower(trim(coalesce(page_lang, 'es'))), 10),
    left(trim(coalesce(referrer_host, '')), 160),
    left(trim(coalesce(utm_source, '')), 120),
    left(trim(coalesce(utm_medium, '')), 120),
    left(trim(coalesce(utm_campaign, '')), 120),
    case
      when metadata is null or jsonb_typeof(metadata) <> 'object' then '{}'::jsonb
      else metadata
    end
  );
end;
$$;

revoke all on function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated;

create or replace function public.get_admin_analytics_dashboard(range_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  days integer := greatest(1, least(coalesce(range_days, 30), 365));
  result_payload jsonb;
begin
  if not private.is_admin() then
    raise exception 'Permiso insuficiente.';
  end if;

  with recent as (
    select *
    from public.analytics_events
    where created_at >= now() - make_interval(days => days)
  ),
  daily_days as (
    select generate_series(
      date_trunc('day', now() - make_interval(days => days - 1)),
      date_trunc('day', now()),
      interval '1 day'
    )::date as day
  ),
  daily_counts as (
    select
      d.day,
      coalesce(sum(case when e.event_name = 'page_view' then 1 else 0 end), 0)::integer as page_views,
      coalesce(sum(case when e.event_name in ('contact_submit', 'quote_cta_click', 'quote_option_select', 'contact_cta_click', 'cta_click', 'email_click', 'phone_click', 'whatsapp_click') then 1 else 0 end), 0)::integer as key_actions
    from daily_days d
    left join recent e on date_trunc('day', e.created_at)::date = d.day
    group by d.day
    order by d.day
  ),
  top_pages as (
    select
      page_path,
      max(nullif(page_title, '')) as page_title,
      count(*)::integer as views
    from recent
    where event_name = 'page_view'
    group by page_path
    order by views desc, page_path asc
    limit 10
  ),
  top_events as (
    select
      event_name,
      count(*)::integer as total
    from recent
    where event_name <> 'page_view'
    group by event_name
    order by total desc, event_name asc
    limit 10
  ),
  top_ctas as (
    select
      coalesce(nullif(metadata->>'label', ''), nullif(metadata->>'target_path', ''), page_path) as label,
      coalesce(metadata->>'target_path', page_path) as target_path,
      count(*)::integer as total
    from recent
    where event_name in ('cta_click', 'contact_cta_click', 'quote_cta_click', 'email_click', 'phone_click', 'whatsapp_click', 'outbound_click')
    group by 1, 2
    order by total desc, label asc
    limit 10
  ),
  domain_events as (
    select
      case
        when event_name like 'product_%' then 'products'
        when event_name like 'blog_%' then 'blog'
        when event_name like 'science_%' then 'science'
        else null
      end as domain,
      event_name,
      metadata,
      page_path
    from recent
  ),
  product_summary as (
    select jsonb_build_object(
      'totals', jsonb_build_object(
        'filterApplies', count(*) filter (where event_name = 'product_filter_apply'),
        'compareAdds', count(*) filter (where event_name = 'product_compare_add'),
        'detailOpens', count(*) filter (where event_name = 'product_detail_open'),
        'ctaClicks', count(*) filter (where event_name = 'product_cta_click')
      ),
      'topProducts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', label,
          'total', total
        ) order by total desc, label asc)
        from (
          select
            coalesce(nullif(metadata->>'product_title', ''), nullif(metadata->>'label', ''), metadata->>'product_id', page_path) as label,
            count(*)::integer as total
          from domain_events
          where domain = 'products'
            and event_name in ('product_cta_click', 'product_detail_open', 'product_compare_add')
          group by 1
          order by total desc, label asc
          limit 6
        ) ranked
      ), '[]'::jsonb),
      'topEvents', coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventName', event_name,
          'total', total
        ) order by total desc, event_name asc)
        from (
          select event_name, count(*)::integer as total
          from domain_events
          where domain = 'products'
          group by 1
          order by total desc, event_name asc
          limit 6
        ) ranked
      ), '[]'::jsonb)
    ) as summary_payload
    from domain_events
    where domain = 'products'
  ),
  blog_summary as (
    select jsonb_build_object(
      'totals', jsonb_build_object(
        'searches', count(*) filter (where event_name = 'blog_search'),
        'tagFilters', count(*) filter (where event_name = 'blog_tag_filter'),
        'postOpens', count(*) filter (where event_name = 'blog_post_open')
      ),
      'topPosts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', label,
          'total', total
        ) order by total desc, label asc)
        from (
          select
            coalesce(nullif(metadata->>'label', ''), metadata->>'post_id', page_path) as label,
            count(*)::integer as total
          from domain_events
          where domain = 'blog'
            and event_name = 'blog_post_open'
          group by 1
          order by total desc, label asc
          limit 6
        ) ranked
      ), '[]'::jsonb),
      'topSearches', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', label,
          'total', total
        ) order by total desc, label asc)
        from (
          select
            coalesce(nullif(metadata->>'search_query', ''), '(sin término)') as label,
            count(*)::integer as total
          from domain_events
          where domain = 'blog'
            and event_name = 'blog_search'
          group by 1
          order by total desc, label asc
          limit 6
        ) ranked
      ), '[]'::jsonb)
    ) as summary_payload
    from domain_events
    where domain = 'blog'
  ),
  science_summary as (
    select jsonb_build_object(
      'totals', jsonb_build_object(
        'arxivFilters', count(*) filter (where event_name = 'science_arxiv_filter'),
        'paperOpens', count(*) filter (where event_name = 'science_arxiv_paper_open'),
        'deckOpens', count(*) filter (where event_name = 'science_widget_deck_open'),
        'templateApplies', count(*) filter (where event_name = 'science_widget_template_apply')
      ),
      'topActions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', label,
          'total', total
        ) order by total desc, label asc)
        from (
          select
            coalesce(nullif(metadata->>'label', ''), nullif(metadata->>'action', ''), event_name) as label,
            count(*)::integer as total
          from domain_events
          where domain = 'science'
          group by 1
          order by total desc, label asc
          limit 6
        ) ranked
      ), '[]'::jsonb),
      'topEvents', coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventName', event_name,
          'total', total
        ) order by total desc, event_name asc)
        from (
          select event_name, count(*)::integer as total
          from domain_events
          where domain = 'science'
          group by 1
          order by total desc, event_name asc
          limit 6
        ) ranked
      ), '[]'::jsonb)
    ) as summary_payload
    from domain_events
    where domain = 'science'
  ),
  recent_signals as (
    select
      event_name,
      page_path,
      created_at,
      coalesce(nullif(metadata->>'label', ''), nullif(metadata->>'form_name', ''), nullif(metadata->>'section', ''), page_path) as label
    from recent
    where event_name in ('contact_submit', 'quote_cta_click', 'quote_option_select', 'contact_cta_click', 'cta_click', 'email_click', 'phone_click', 'whatsapp_click', 'form_submit', 'outbound_click')
    order by created_at desc
    limit 12
  )
  select jsonb_build_object(
    'rangeDays', days,
    'totals', jsonb_build_object(
      'pageViews', coalesce((select count(*) from recent where event_name = 'page_view'), 0),
      'uniqueVisitors', coalesce((select count(distinct visitor_id) from recent), 0),
      'engagedVisits', coalesce((select count(*) from recent where event_name = 'engaged_visit'), 0),
      'contactSubmits', coalesce((select count(*) from recent where event_name = 'contact_submit'), 0),
      'quoteSignals', coalesce((select count(*) from recent where event_name in ('quote_cta_click', 'quote_option_select')), 0),
      'ctaClicks', coalesce((select count(*) from recent where event_name in ('cta_click', 'contact_cta_click', 'quote_cta_click')), 0)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', to_char(day, 'YYYY-MM-DD'),
        'pageViews', page_views,
        'keyActions', key_actions
      ) order by day)
      from daily_counts
    ), '[]'::jsonb),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pagePath', page_path,
        'pageTitle', coalesce(page_title, ''),
        'views', views
      ) order by views desc, page_path asc)
      from top_pages
    ), '[]'::jsonb),
    'topEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventName', event_name,
        'total', total
      ) order by total desc, event_name asc)
      from top_events
    ), '[]'::jsonb),
    'topCtas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', label,
        'targetPath', target_path,
        'total', total
      ) order by total desc, label asc)
      from top_ctas
    ), '[]'::jsonb),
    'domainBreakdowns', jsonb_build_object(
      'products', coalesce((select summary_payload from product_summary), jsonb_build_object('totals', jsonb_build_object(), 'topProducts', '[]'::jsonb, 'topEvents', '[]'::jsonb)),
      'blog', coalesce((select summary_payload from blog_summary), jsonb_build_object('totals', jsonb_build_object(), 'topPosts', '[]'::jsonb, 'topSearches', '[]'::jsonb)),
      'science', coalesce((select summary_payload from science_summary), jsonb_build_object('totals', jsonb_build_object(), 'topActions', '[]'::jsonb, 'topEvents', '[]'::jsonb))
    ),
    'recentSignals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventName', event_name,
        'pagePath', page_path,
        'createdAt', created_at,
        'label', label
      ) order by created_at desc)
      from recent_signals
    ), '[]'::jsonb)
  )
  into result_payload;

  return coalesce(result_payload, '{}'::jsonb);
end;
$$;

revoke all on function public.get_admin_analytics_dashboard(integer) from public, anon, authenticated;
grant execute on function public.get_admin_analytics_dashboard(integer) to authenticated;
