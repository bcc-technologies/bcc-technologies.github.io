create or replace function private.can_manage_signals()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.role = 'admin'
        or 'department_director' = any(coalesce(profile.staff_roles, array[]::text[]))
        or exists (
          select 1
          from public.workspace_role_definitions definition
          where definition.id = any(coalesce(profile.custom_roles, array[]::text[]))
            and 'department:manage' = any(coalesce(definition.permissions, array[]::text[]))
        )
      )
  );
$$;

revoke all on function private.can_manage_signals() from public, anon;
grant execute on function private.can_manage_signals() to authenticated, service_role;
;
