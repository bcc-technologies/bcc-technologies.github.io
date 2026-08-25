-- Add real user (and future team) ownership to workspace prospects, replacing
-- free-text owner_label as the source of truth for who is assigned.
--
-- owner_label is kept as a denormalized display cache: the app writes it
-- alongside owner_user_id so every existing read path (board cards,
-- directory rows, filters) keeps working unchanged. When owner_type = 'team'
-- is introduced later, owner_label becomes the team's display text instead
-- and no further schema change is needed then.

alter table public.workspace_prospects
  add column if not exists owner_type text not null default 'user';

alter table public.workspace_prospects
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_prospects_owner_type_check') then
    alter table public.workspace_prospects
      add constraint workspace_prospects_owner_type_check
      check (owner_type in ('user', 'team'));
  end if;
end;
$$;

create index if not exists workspace_prospects_owner_user_idx
on public.workspace_prospects (owner_user_id, updated_at desc);

-- Least-privilege lookup for the assignment dropdown: returns only id +
-- display name for staff/admin profiles, gated by the same rule as the
-- rest of the CRM (private.can_manage_signals()). Callers cannot read any
-- other column of public.profiles through this function, unlike a direct
-- table grant would allow.
create or replace function public.list_assignable_prospect_owners()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, coalesce(nullif(p.display_name, ''), nullif(p.full_name, ''), p.email) as display_name
  from public.profiles p
  where private.can_manage_signals()
    and p.role in ('staff', 'admin')
  order by 2;
$$;

revoke all on function public.list_assignable_prospect_owners() from public, anon;
grant execute on function public.list_assignable_prospect_owners() to authenticated;
;
