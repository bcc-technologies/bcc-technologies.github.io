-- Apply after SUPABASE_WORKSPACE_FORMS.sql on projects that already created the form tables.
-- Allows admins and staff with the department_director role to create, publish,
-- update, and inspect workspace forms without granting broader admin access.

create or replace function private.can_manage_workspace_forms()
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
        or 'department_director' = any(staff_roles)
      )
  );
$$;

revoke all on function private.can_manage_workspace_forms() from public, anon;
grant execute on function private.can_manage_workspace_forms() to authenticated, service_role;

drop policy if exists "Admins manage workspace forms" on public.workspace_forms;
drop policy if exists "Form managers manage workspace forms" on public.workspace_forms;
create policy "Form managers manage workspace forms"
on public.workspace_forms
for all
to authenticated
using (private.can_manage_workspace_forms())
with check (private.can_manage_workspace_forms());

drop policy if exists "Admins read form responses" on public.workspace_form_responses;
drop policy if exists "Form managers read form responses" on public.workspace_form_responses;
create policy "Form managers read form responses"
on public.workspace_form_responses
for select
to authenticated
using (private.can_manage_workspace_forms());
