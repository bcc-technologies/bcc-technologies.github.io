-- Fix a regression that undid the read-side half of author isolation.
--
-- 20260913120000_cms_posts_author_isolation.sql rewrote the CRUD policies on
-- public.cms_posts, but production already had one extra SELECT policy that
-- migration didn't know about: "Authenticated can read permitted CMS posts",
-- applied ad hoc from resources/SUPABASE_SECURITY_HARDENING.sql (it isn't a
-- tracked migration, so `supabase migration list` never showed it). That
-- policy still granted every "authenticated" request read access whenever
-- private.can_manage_cms_content() was true -- i.e. any CMS user, including
-- a plain author -- which fully undid the new "Authors read own posts" /
-- "CMS managers read all posts" split for reads: Postgres OR's all matching
-- permissive policies together, so this one alone kept every author able to
-- read every other author's drafts.
--
-- This migration folds the intent of that hardening policy (one consolidated
-- SELECT policy for "authenticated", to avoid evaluating several) back
-- together correctly: published posts, or your own post, or any post if
-- you're a manager. resources/SUPABASE_SECURITY_HARDENING.sql is updated to
-- match so re-running it from scratch on a fresh project doesn't reintroduce
-- this gap.

drop policy if exists "CMS managers read all posts" on public.cms_posts;
drop policy if exists "Authors read own posts" on public.cms_posts;
drop policy if exists "Authenticated can read permitted CMS posts" on public.cms_posts;

create policy "Authenticated can read permitted CMS posts"
on public.cms_posts
for select
to authenticated
using (
  is_published = true
  or (select private.is_cms_manager())
  or (
    (select private.can_manage_cms_content())
    and created_by = (select auth.uid())
  )
);
