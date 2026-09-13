-- private.set_user_access silently discarded staff_roles/departments/
-- custom_roles whenever next_role wasn't 'staff' or 'admin':
--
--   final_staff_roles := case when next_role in ('staff', 'admin')
--     then clean_staff_roles else '{}'::text[] end;
--
-- The admin-users panel (js/workspace/admin-users.js) lets an admin pick the
-- base role and check staff-role boxes (e.g. "Autor") as two independent
-- controls in the same modal, with nothing disabling one based on the
-- other. If an admin left the base role on "Cliente" while checking
-- "Autor", the call would silently succeed with the checked boxes thrown
-- away -- the UI's own preview even showed "CMS" as granted, because
-- updateAccessPreview() only looks at the checkboxes, not this rule. The
-- admin would see no error and reasonably believe the access was granted.
--
-- Fail loud instead: reject the mismatched combination so the caller has to
-- fix it (bump the role to staff/admin, or clear the boxes) rather than
-- silently getting different access than what was submitted.
create or replace function private.set_user_access(
  target_user_id uuid,
  next_role text,
  next_staff_roles text[] default null,
  next_departments text[] default null,
  next_custom_roles text[] default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  target_role text;
  target_email text;
  active_admin_count integer;
  clean_staff_roles text[] := coalesce(next_staff_roles, '{}'::text[]);
  clean_departments text[] := coalesce(next_departments, '{}'::text[]);
  clean_custom_roles text[] := coalesce(next_custom_roles, '{}'::text[]);
  old_staff_roles text[];
  old_departments text[];
  old_custom_roles text[];
  final_staff_roles text[];
  final_departments text[];
  final_custom_roles text[];
begin
  clean_staff_roles := array(select distinct unnest(clean_staff_roles));
  clean_departments := array(select distinct unnest(clean_departments));
  clean_custom_roles := array(select distinct unnest(clean_custom_roles));

  if next_role not in ('client', 'staff', 'admin') then raise exception 'Rol invalido'; end if;
  if not clean_staff_roles <@ array[
    'author', 'cofounder', 'department_director',
    'maps_developer', 'maps_release_manager', 'maps_license_manager', 'maps_product_analyst'
  ]::text[] then raise exception 'Rol interno invalido'; end if;
  if not clean_departments <@ array['technology', 'finance', 'operations', 'marketing', 'hr']::text[] then
    raise exception 'Departamento invalido';
  end if;
  if exists (
    select 1 from unnest(clean_custom_roles) as selected(id)
    left join public.workspace_role_definitions role_def on role_def.id = selected.id
    where role_def.id is null
  ) then raise exception 'Rol personalizado invalido'; end if;

  if next_role = 'client' and (
    cardinality(clean_staff_roles) > 0
    or cardinality(clean_departments) > 0
    or cardinality(clean_custom_roles) > 0
  ) then
    raise exception
      'Una cuenta con rol Cliente no puede tener roles internos, departamentos ni roles personalizados. Cambia el rol base a Staff o Admin, o quita esas selecciones.'
      using errcode = '22023';
  end if;

  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'admin' then raise exception 'Permiso insuficiente'; end if;

  select role, staff_roles, departments, custom_roles, email
  into target_role, old_staff_roles, old_departments, old_custom_roles, target_email
  from public.profiles where id = target_user_id;
  if target_role is null then raise exception 'Usuario no encontrado'; end if;
  if target_user_id = auth.uid() and target_role = 'admin' and next_role <> 'admin' then
    raise exception 'No puedes quitarte tu propio rol de administrador';
  end if;
  select count(*) into active_admin_count from public.profiles where role = 'admin';
  if target_role = 'admin' and next_role <> 'admin' and active_admin_count <= 1 then
    raise exception 'Debe existir al menos un administrador activo';
  end if;

  final_staff_roles := clean_staff_roles;
  final_departments := clean_departments;
  final_custom_roles := clean_custom_roles;

  update public.profiles
  set role = next_role, staff_roles = final_staff_roles, departments = final_departments,
      custom_roles = final_custom_roles, updated_at = now()
  where id = target_user_id;

  if target_role is distinct from next_role
     or old_staff_roles is distinct from final_staff_roles
     or old_departments is distinct from final_departments
     or old_custom_roles is distinct from final_custom_roles then
    insert into public.access_audit_logs (
      actor_id, target_user_id, actor_email, target_email, before_access, after_access
    ) values (
      auth.uid(), target_user_id,
      coalesce((select email from public.profiles where id = auth.uid()), ''),
      coalesce(target_email, ''),
      jsonb_build_object('role', target_role, 'staffRoles', old_staff_roles, 'departments', old_departments, 'customRoles', old_custom_roles),
      jsonb_build_object('role', next_role, 'staffRoles', final_staff_roles, 'departments', final_departments, 'customRoles', final_custom_roles)
    );
  end if;
end;
$$;

-- While tracing this bug, live introspection of the deployed database (via
-- has_function_privilege) turned up a second, more severe issue: migration
-- 20260715041320_platform_staff_role_assignments.sql revoked EXECUTE on
-- this 5-argument private function from "authenticated" (`revoke all ...
-- from public, anon, authenticated;`) and never granted it back -- unlike
-- the 4-argument overload, which still has it. public.set_user_access (the
-- function actually called via `supabase.rpc("set_user_access", ...)` from
-- js/auth-admin-access-api.js) is SECURITY INVOKER, so calling it as
-- "authenticated" runs this private function as "authenticated" too, and
-- that role has had no EXECUTE grant on it since that migration ran. In
-- other words: right now, in production, ANY admin trying to save role
-- changes through the Usuarios panel gets a bare "permission denied for
-- function set_user_access" for every save that includes next_custom_roles
-- -- which js/auth-admin-access-api.js always sends. Restore the grant.
revoke all on function private.set_user_access(uuid, text, text[], text[], text[]) from public, anon;
grant execute on function private.set_user_access(uuid, text, text[], text[], text[]) to authenticated, service_role;
