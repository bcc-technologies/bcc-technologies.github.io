-- Apply after SUPABASE_WORKSPACE_FORMS.sql on projects that already created the form tables.
-- Ensures respondents can only submit forms published for their own audience.

drop policy if exists "Recipients submit own published forms" on public.workspace_form_responses;
create policy "Recipients submit own published forms"
on public.workspace_form_responses
for insert
to authenticated
with check (
  (select auth.uid()) = respondent_id
  and exists (
    select 1
    from public.workspace_forms
    join public.profiles on profiles.id = (select auth.uid())
    where workspace_forms.id = workspace_form_responses.form_id
      and workspace_forms.status = 'published'
      and (
        (workspace_forms.audience = 'client' and profiles.role = 'client')
        or (workspace_forms.audience = 'staff' and profiles.role = 'staff')
      )
  )
);

drop policy if exists "Recipients update own published forms" on public.workspace_form_responses;
create policy "Recipients update own published forms"
on public.workspace_form_responses
for update
to authenticated
using ((select auth.uid()) = respondent_id)
with check (
  (select auth.uid()) = respondent_id
  and exists (
    select 1
    from public.workspace_forms
    join public.profiles on profiles.id = (select auth.uid())
    where workspace_forms.id = workspace_form_responses.form_id
      and workspace_forms.status = 'published'
      and (
        (workspace_forms.audience = 'client' and profiles.role = 'client')
        or (workspace_forms.audience = 'staff' and profiles.role = 'staff')
      )
  )
);
