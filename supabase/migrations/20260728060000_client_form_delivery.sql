-- Client forms are deliveries, not an audience-wide bulletin board.
-- This migration expects the legacy workspace form tables to be present.

alter table public.workspace_forms
  add column if not exists recipient_ids uuid[] not null default '{}'::uuid[];

-- Published legacy client forms had no explicit recipient. Keep them out of
-- client inboxes until a form manager assigns recipients deliberately.
update public.workspace_forms
set status = 'draft'
where audience = 'client'
  and status = 'published'
  and cardinality(recipient_ids) = 0;

-- Keep form management aligned with the existing workspace-form policies.
-- The dedicated predicate prevents delivery policies from widening that scope.
create or replace function private.can_manage_workspace_forms()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_admin();
$$;

revoke all on function private.can_manage_workspace_forms() from public, anon, authenticated;
-- The RLS policies invoke this predicate as the requesting role.  It remains
-- unavailable to anon and PUBLIC, and is not exposed through the Data API.
grant execute on function private.can_manage_workspace_forms() to authenticated;

create or replace function private.validate_workspace_form_recipients()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(array_agg(distinct recipient_id order by recipient_id), '{}'::uuid[])
  into new.recipient_ids
  from unnest(coalesce(new.recipient_ids, '{}'::uuid[])) as recipient_id;

  if cardinality(new.recipient_ids) > 100 then
    raise exception 'A form can be delivered to at most 100 accounts';
  end if;

  if new.audience = 'client' then
    if new.status = 'published' and cardinality(new.recipient_ids) = 0 then
      raise exception 'A published client form requires at least one recipient';
    end if;

    if cardinality(new.recipient_ids) > 0 and (
      select count(*)
      from public.profiles profile
      where profile.id = any(new.recipient_ids)
        and profile.role = 'client'
    ) <> cardinality(new.recipient_ids) then
      raise exception 'Every recipient must be an active client account';
    end if;
  elsif cardinality(new.recipient_ids) > 0 then
    raise exception 'Recipient delivery is only supported for client forms';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_workspace_form_recipients() from public, anon, authenticated;

drop trigger if exists workspace_forms_validate_recipients on public.workspace_forms;
create trigger workspace_forms_validate_recipients
before insert or update of audience, recipient_ids, status on public.workspace_forms
for each row execute function private.validate_workspace_form_recipients();

create index if not exists workspace_forms_client_recipients_idx
on public.workspace_forms using gin (recipient_ids)
where audience = 'client' and status = 'published';

create or replace function public.list_workspace_form_recipients()
returns table (
  id uuid,
  label text,
  email text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.can_manage_workspace_forms() then
    raise exception 'Permission denied';
  end if;

  return query
  select
    profile.id,
    coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email),
    profile.email
  from public.profiles profile
  where profile.role = 'client'
  order by coalesce(nullif(profile.display_name, ''), nullif(profile.full_name, ''), profile.email), profile.id;
end;
$$;

revoke all on function public.list_workspace_form_recipients() from public, anon;
grant execute on function public.list_workspace_form_recipients() to authenticated, service_role;

drop policy if exists "Recipients read published workspace forms" on public.workspace_forms;
drop policy if exists "Authenticated can read permitted workspace forms" on public.workspace_forms;
drop policy if exists "Recipients read delivered workspace forms" on public.workspace_forms;
create policy "Recipients read delivered workspace forms"
on public.workspace_forms
for select
to authenticated
using (
  (select private.can_manage_workspace_forms())
  or (
    status = 'published'
    and audience = 'client'
    and recipient_ids @> array[(select auth.uid())]::uuid[]
  )
  or (
    status = 'published'
    and audience = 'staff'
    and exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and profile.role = 'staff'
    )
  )
);

drop policy if exists "Recipients submit own published forms" on public.workspace_form_responses;
drop policy if exists "Recipients update own published forms" on public.workspace_form_responses;
drop policy if exists "Recipients submit delivered workspace forms" on public.workspace_form_responses;
drop policy if exists "Recipients update delivered workspace forms" on public.workspace_form_responses;
create policy "Recipients submit delivered workspace forms"
on public.workspace_form_responses
for insert
to authenticated
with check (
  (select auth.uid()) = respondent_id
  and exists (
    select 1
    from public.workspace_forms form
    where form.id = workspace_form_responses.form_id
      and form.status = 'published'
      and (
        (form.audience = 'client' and form.recipient_ids @> array[(select auth.uid())]::uuid[])
        or (
          form.audience = 'staff'
          and exists (
            select 1 from public.profiles profile
            where profile.id = (select auth.uid()) and profile.role = 'staff'
          )
        )
      )
  )
);

create policy "Recipients update delivered workspace forms"
on public.workspace_form_responses
for update
to authenticated
using ((select auth.uid()) = respondent_id)
with check (
  (select auth.uid()) = respondent_id
  and exists (
    select 1
    from public.workspace_forms form
    where form.id = workspace_form_responses.form_id
      and form.status = 'published'
      and (
        (form.audience = 'client' and form.recipient_ids @> array[(select auth.uid())]::uuid[])
        or (
          form.audience = 'staff'
          and exists (
            select 1 from public.profiles profile
            where profile.id = (select auth.uid()) and profile.role = 'staff'
          )
        )
      )
  )
);

comment on column public.workspace_forms.recipient_ids is
'Explicit client accounts allowed to receive a published client form. Empty only while drafting.';
