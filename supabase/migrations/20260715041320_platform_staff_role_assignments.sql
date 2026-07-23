-- Makes license-manager and product-analyst platform roles assignable through
-- the existing profile access workflow used by the staff dashboard.

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

  final_staff_roles := case when next_role in ('staff', 'admin') then clean_staff_roles else '{}'::text[] end;
  final_departments := case when next_role in ('staff', 'admin') then clean_departments else '{}'::text[] end;
  final_custom_roles := case when next_role in ('staff', 'admin') then clean_custom_roles else '{}'::text[] end;

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

revoke all on function private.set_user_access(uuid, text, text[], text[], text[]) from public, anon, authenticated;

create or replace function private.sync_platform_internal_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  desired_roles text[] := '{}'::text[];
  desired_role text;
begin
  if new.role = 'admin' then
    desired_roles := array['internal.admin'];
  elsif new.role = 'staff' then
    desired_roles := array['internal.staff'];
    if 'maps_developer' = any(coalesce(new.staff_roles, '{}'::text[])) then
      desired_roles := array_append(desired_roles, 'internal.maps.developer');
    end if;
    if 'maps_release_manager' = any(coalesce(new.staff_roles, '{}'::text[])) then
      desired_roles := array_append(desired_roles, 'internal.maps.release.manager');
    end if;
    if 'maps_license_manager' = any(coalesce(new.staff_roles, '{}'::text[])) then
      desired_roles := array_append(desired_roles, 'internal.license.manager');
    end if;
    if 'maps_product_analyst' = any(coalesce(new.staff_roles, '{}'::text[])) then
      desired_roles := array_append(desired_roles, 'internal.product.analyst');
    end if;
  end if;

  update public.platform_user_roles
  set revoked_at = now()
  where user_id = new.id and source = 'profile-sync' and revoked_at is null
    and not (role_key = any(desired_roles));

  foreach desired_role in array desired_roles loop
    insert into public.platform_user_roles (user_id, role_key, source)
    values (new.id, desired_role, 'profile-sync')
    on conflict (user_id, role_key) where revoked_at is null do nothing;
  end loop;
  return new;
end;
$$;

revoke all on function private.sync_platform_internal_role() from public, anon, authenticated;
update public.profiles set staff_roles = staff_roles;
