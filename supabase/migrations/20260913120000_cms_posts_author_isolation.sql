-- Isolate CMS drafts by author.
--
-- Previously, "CMS managers read/insert/update/delete posts" granted full
-- access to every row in public.cms_posts to *any* user who could pass
-- private.can_manage_cms_content() (role = 'admin' OR staff_roles overlaps
-- ['author', 'cofounder', 'department_director']). That meant a plain
-- "author" could see, edit, and delete drafts written by every other author
-- (and vice versa) -- there was no per-row ownership check even though the
-- table already tracks who wrote each row (created_by).
--
-- Note: author_ids is *not* an ownership/access field -- it is a list of
-- public "Author" byline entities (see the separate authors content type
-- rendered by the CMS's Authors tab) used to credit a published piece, not
-- a set of Supabase auth user ids. Isolation below is keyed on created_by
-- only, which the private.set_cms_post_timestamps() trigger always sets
-- from auth.uid() and the client never gets to override.
--
-- This migration splits "can use the CMS at all" (unchanged:
-- private.can_manage_cms_content()) from "can manage every post regardless
-- of who wrote it" (new: private.is_cms_manager(), restricted to role =
-- 'admin'). Note this is deliberately NOT staff_roles @> cofounder /
-- department_director: those are organizational titles (they also grant
-- things like strategy:view / department:manage in
-- shared/access-contracts.json) and are independent of whether someone
-- should see every other author's unpublished blog drafts -- conflating
-- the two was the actual bug (a real cofounder/director, who is also a
-- staff "author", ended up with blanket visibility they never should have
-- had). Everyone who isn't role = 'admin' -- author, cofounder, director,
-- whatever their title -- keeps full CRUD on their own posts (created_by =
-- auth.uid()) but loses visibility and write access to posts they didn't
-- write.

create or replace function private.is_cms_manager()
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
      and role = 'admin'
  );
$$;

revoke all on function private.is_cms_manager() from public, anon;
grant execute on function private.is_cms_manager() to authenticated, service_role;

comment on function private.can_manage_cms_content() is
'True for anyone allowed to use the CMS at all (admin, cofounder, department_director, author). Does not imply access to other authors'' rows -- see private.is_cms_manager() and the per-row policies on public.cms_posts.';

comment on function private.is_cms_manager() is
'True only for role = admin. Deliberately independent of staff_roles (cofounder/department_director are organizational titles, not a content-oversight grant) -- everyone else is scoped to their own posts by the "own" RLS policies on public.cms_posts.';

-- Replace the "managers can touch everything" policies so they actually
-- mean "managers" (role = admin), not "anyone with CMS access".

drop policy if exists "CMS managers read all posts" on public.cms_posts;
create policy "CMS managers read all posts"
on public.cms_posts
for select
to authenticated
using (private.is_cms_manager());

drop policy if exists "CMS managers update posts" on public.cms_posts;
create policy "CMS managers update posts"
on public.cms_posts
for update
to authenticated
using (private.is_cms_manager())
with check (private.is_cms_manager());

drop policy if exists "CMS managers delete posts" on public.cms_posts;
create policy "CMS managers delete posts"
on public.cms_posts
for delete
to authenticated
using (private.is_cms_manager());

-- Insert stays open to anyone with general CMS access -- an author is
-- still allowed to create their own new drafts.
drop policy if exists "CMS managers insert posts" on public.cms_posts;
create policy "CMS managers insert posts"
on public.cms_posts
for insert
to authenticated
with check (private.can_manage_cms_content());

-- New: authors can always see, edit, and delete their own posts, even
-- though they are not "managers" under the definition above.

drop policy if exists "Authors read own posts" on public.cms_posts;
create policy "Authors read own posts"
on public.cms_posts
for select
to authenticated
using (
  private.can_manage_cms_content()
  and created_by = auth.uid()
);

drop policy if exists "Authors update own posts" on public.cms_posts;
create policy "Authors update own posts"
on public.cms_posts
for update
to authenticated
using (
  private.can_manage_cms_content()
  and created_by = auth.uid()
)
with check (
  private.can_manage_cms_content()
  and created_by = auth.uid()
);

drop policy if exists "Authors delete own posts" on public.cms_posts;
create policy "Authors delete own posts"
on public.cms_posts
for delete
to authenticated
using (
  private.can_manage_cms_content()
  and created_by = auth.uid()
);

-- publish_cms_post let anyone with general CMS access publish/unpublish
-- *any* post, which reopens the same cross-author hole for the publish
-- flag specifically. Restrict it to managers or the post's own author.
create or replace function public.publish_cms_post(p_post_id text)
returns public.cms_posts
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  published_post public.cms_posts;
  is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Insufficient permission to publish CMS posts'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.cms_posts
    where id = p_post_id
      and created_by = auth.uid()
  ) into is_owner;

  if not (private.is_cms_manager() or (private.can_manage_cms_content() and is_owner)) then
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
grant execute on function public.publish_cms_post(text) to authenticated;

-- The CMS UI wants to show "written by <name>" next to posts a manager can
-- see, so people can tell whose draft they're looking at now that everyone
-- who isn't role = 'admin' is isolated to their own posts. public.profiles
-- already only exposes other users' rows to role = 'admin' (see
-- resources/SUPABASE_AUTH_SETUP.sql), which happens to line up exactly with
-- private.is_cms_manager() -- this narrow, security definer lookup exists
-- only so the CMS can call it under its own RPC name without depending on
-- that coincidence: it returns a display name only for ids the caller is
-- entitled to know about (their own id, or any id at all if they are a CMS
-- manager).
create or replace function public.get_cms_author_names(p_ids uuid[])
returns table(id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), ''), p.email)
  from public.profiles p
  where p.id = any(p_ids)
    and (p.id = auth.uid() or private.is_cms_manager());
$$;

revoke all on function public.get_cms_author_names(uuid[]) from public, anon;
grant execute on function public.get_cms_author_names(uuid[]) to authenticated;
