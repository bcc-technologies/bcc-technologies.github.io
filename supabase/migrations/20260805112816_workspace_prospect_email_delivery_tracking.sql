-- Track Resend delivery/bounce/open/click events per prospect email.
--
-- Written only by the resend-delivery-webhook Edge Function using the
-- service role key (bypasses RLS, like send-prospect-email already does).
-- The browser client never sends these fields: normalizeWorkspaceProspectEmailInput
-- has no mapping for them, so a PATCH from the CRM UI cannot set them.

alter table public.workspace_prospect_emails
  add column if not exists delivery_status text not null default '';

alter table public.workspace_prospect_emails
  add column if not exists delivery_status_at timestamptz;

alter table public.workspace_prospect_emails
  add column if not exists delivery_detail text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_prospect_emails_delivery_status_check') then
    alter table public.workspace_prospect_emails
      add constraint workspace_prospect_emails_delivery_status_check
      check (delivery_status in ('', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'opened', 'clicked', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workspace_prospect_emails_delivery_detail_check') then
    alter table public.workspace_prospect_emails
      add constraint workspace_prospect_emails_delivery_detail_check
      check (char_length(delivery_detail) <= 500);
  end if;
end;
$$;

create index if not exists workspace_prospect_emails_provider_message_idx
on public.workspace_prospect_emails (provider_message_id)
where provider_message_id <> '';
;
