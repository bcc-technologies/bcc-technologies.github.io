-- Posts are drafts by default. Publishing is a separate, authenticated action.
create table if not exists private.cms_post_publication_audit (
  id bigint generated always as identity primary key,
  post_id text not null references public.cms_posts(id) on delete cascade,
  action text not null check (action in ('published', 'unpublished')),
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

revoke all on table private.cms_post_publication_audit from public, anon, authenticated;

create index if not exists cms_post_publication_audit_post_occurred_idx
  on private.cms_post_publication_audit (post_id, occurred_at desc);

create or replace function private.set_cms_post_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    -- A normal save can never create a public post.
    new.is_published := false;
  elsif old.is_published is distinct from new.is_published then
    if new.is_published
      and coalesce(current_setting('app.cms_publish_intent', true), '') <> 'true' then
      raise exception 'Use publish_cms_post to publish a CMS post'
        using errcode = '42501';
    end if;

    insert into private.cms_post_publication_audit (post_id, action, actor_id)
    values (new.id, case when new.is_published then 'published' else 'unpublished' end, auth.uid());
  end if;

  if new.is_published and new.published_at is null then
    new.published_at := now();
  elsif not new.is_published then
    new.published_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.publish_cms_post(p_post_id text)
returns public.cms_posts
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  published_post public.cms_posts;
begin
  if auth.uid() is null or not private.can_manage_cms_content() then
    raise exception 'Insufficient permission to publish CMS posts'
      using errcode = '42501';
  end if;

  perform set_config('app.cms_publish_intent', 'true', true);

  update public.cms_posts
  set is_published = true
  where id = p_post_id
  returning * into published_post;

  if not found then
    raise exception 'CMS post not found'
      using errcode = 'P0002';
  end if;

  return published_post;
end;
$$;

revoke all on function public.publish_cms_post(text) from public;
grant execute on function public.publish_cms_post(text) to authenticated;;
