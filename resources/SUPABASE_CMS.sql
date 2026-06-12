-- BCC Technologies web CMS for Supabase.
-- Run after SUPABASE_AUTH_SETUP.sql so profiles/private helpers exist.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.can_manage_cms_content()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or staff_roles && array['author', 'cofounder', 'department_director']::text[]
      )
  );
$$;

revoke all on function private.can_manage_cms_content() from public, anon;
grant execute on function private.can_manage_cms_content() to authenticated, service_role;

create table if not exists public.cms_posts (
  id text primary key,
  title text not null default '',
  date date,
  section text not null default '',
  lang text not null default 'es' check (lang in ('es', 'en')),
  translation_id text not null default '',
  tags text[] not null default '{}',
  author_ids text[] not null default '{}',
  reference_ids text[] not null default '{}',
  resource_ids text[] not null default '{}',
  excerpt text not null default '',
  cover text not null default '',
  body_markdown text not null default '',
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cms_posts add column if not exists date date;
alter table public.cms_posts add column if not exists section text not null default '';
alter table public.cms_posts add column if not exists lang text not null default 'es';
alter table public.cms_posts add column if not exists translation_id text not null default '';
alter table public.cms_posts add column if not exists tags text[] not null default '{}';
alter table public.cms_posts add column if not exists author_ids text[] not null default '{}';
alter table public.cms_posts add column if not exists reference_ids text[] not null default '{}';
alter table public.cms_posts add column if not exists resource_ids text[] not null default '{}';
alter table public.cms_posts add column if not exists excerpt text not null default '';
alter table public.cms_posts add column if not exists cover text not null default '';
alter table public.cms_posts add column if not exists body_markdown text not null default '';
alter table public.cms_posts add column if not exists is_published boolean not null default false;
alter table public.cms_posts add column if not exists published_at timestamptz;
alter table public.cms_posts add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.cms_posts add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.cms_posts add column if not exists created_at timestamptz not null default now();
alter table public.cms_posts add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cms_posts_lang_check'
      and conrelid = 'public.cms_posts'::regclass
  ) then
    alter table public.cms_posts
    add constraint cms_posts_lang_check check (lang in ('es', 'en'));
  end if;
end $$;

create index if not exists cms_posts_published_lang_date_idx
on public.cms_posts (is_published, lang, date desc);

create or replace function private.set_cms_post_timestamps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;

  if new.is_published and new.published_at is null then
    new.published_at := now();
  elsif not new.is_published then
    new.published_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.set_cms_post_timestamps() from public, anon, authenticated;
grant execute on function private.set_cms_post_timestamps() to service_role;

drop trigger if exists cms_posts_set_timestamps on public.cms_posts;
create trigger cms_posts_set_timestamps
before insert or update on public.cms_posts
for each row execute function private.set_cms_post_timestamps();

alter table public.cms_posts enable row level security;

revoke all on public.cms_posts from public, anon, authenticated;
grant select on public.cms_posts to anon, authenticated;
grant insert, update, delete on public.cms_posts to authenticated;

drop policy if exists "Published CMS posts are public" on public.cms_posts;
create policy "Published CMS posts are public"
on public.cms_posts
for select
to anon, authenticated
using (is_published = true);

drop policy if exists "CMS managers read all posts" on public.cms_posts;
create policy "CMS managers read all posts"
on public.cms_posts
for select
to authenticated
using (private.can_manage_cms_content());

drop policy if exists "CMS managers insert posts" on public.cms_posts;
create policy "CMS managers insert posts"
on public.cms_posts
for insert
to authenticated
with check (private.can_manage_cms_content());

drop policy if exists "CMS managers update posts" on public.cms_posts;
create policy "CMS managers update posts"
on public.cms_posts
for update
to authenticated
using (private.can_manage_cms_content())
with check (private.can_manage_cms_content());

drop policy if exists "CMS managers delete posts" on public.cms_posts;
create policy "CMS managers delete posts"
on public.cms_posts
for delete
to authenticated
using (private.can_manage_cms_content());

comment on table public.cms_posts is
'Database-backed CMS posts used by the official website and web CMS.';
