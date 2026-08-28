create or replace function public.claim_workspace_push_notifications(batch_size integer default 25)
returns table (
  notification_id uuid,
  user_id uuid,
  title text,
  body text,
  target_url text,
  tag text,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with picked as (
    select q.id
    from public.workspace_notification_queue q
    where q.status = 'pending'
      and q.notify_at <= now()
      and q.attempts < 5
      and exists (
        select 1
        from public.workspace_push_subscriptions s
        where s.user_id = q.user_id
      )
    order by q.notify_at, q.created_at
    limit least(greatest(batch_size, 1), 100)
    for update skip locked
  ), marked as (
    update public.workspace_notification_queue q
    set status = 'processing', attempts = q.attempts + 1
    from picked
    where q.id = picked.id
    returning q.*
  )
  select
    marked.id,
    marked.user_id,
    marked.title,
    marked.body,
    marked.target_url,
    marked.tag,
    s.id,
    s.endpoint,
    s.p256dh,
    s.auth
  from marked
  join public.workspace_push_subscriptions s on s.user_id = marked.user_id;
end;
$$;

revoke all on function public.claim_workspace_push_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_push_notifications(integer) to service_role;;
