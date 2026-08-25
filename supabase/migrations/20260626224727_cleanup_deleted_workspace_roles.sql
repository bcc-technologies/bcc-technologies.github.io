create or replace function private.remove_deleted_workspace_role_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set custom_roles = array_remove(custom_roles, old.id),
      updated_at = now()
  where custom_roles @> array[old.id]::text[];
  return old;
end;
$$;

revoke all on function private.remove_deleted_workspace_role_from_profiles() from public, anon, authenticated;
grant execute on function private.remove_deleted_workspace_role_from_profiles() to service_role;

drop trigger if exists remove_deleted_workspace_role_from_profiles on public.workspace_role_definitions;
create trigger remove_deleted_workspace_role_from_profiles
after delete on public.workspace_role_definitions
for each row execute function private.remove_deleted_workspace_role_from_profiles();;
