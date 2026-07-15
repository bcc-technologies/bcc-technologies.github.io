-- Make deny-by-default policies explicit for platform tables whose data is
-- available only through bounded RPCs. Service-role administration continues
-- to bypass RLS; browser clients receive no direct account, license or role
-- rows.

drop policy if exists "No direct authenticated platform access" on public.platform_permissions;
create policy "No direct authenticated platform access"
on public.platform_permissions as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.platform_roles;
create policy "No direct authenticated platform access"
on public.platform_roles as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.platform_role_permissions;
create policy "No direct authenticated platform access"
on public.platform_role_permissions as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.platform_user_roles;
create policy "No direct authenticated platform access"
on public.platform_user_roles as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.license_accounts;
create policy "No direct authenticated platform access"
on public.license_accounts as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.license_account_members;
create policy "No direct authenticated platform access"
on public.license_account_members as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.platform_licenses;
create policy "No direct authenticated platform access"
on public.platform_licenses as restrictive for all to authenticated
using (false) with check (false);

drop policy if exists "No direct authenticated platform access" on public.license_assignments;
create policy "No direct authenticated platform access"
on public.license_assignments as restrictive for all to authenticated
using (false) with check (false);
