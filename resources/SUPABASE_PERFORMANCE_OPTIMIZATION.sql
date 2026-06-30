-- BCC Supabase performance cleanup.
-- Adds covering indexes for foreign keys reported by Supabase Performance Advisor.
-- These are additive and safe to re-run.

create index if not exists access_audit_logs_actor_id_idx
  on public.access_audit_logs (actor_id);

create index if not exists access_audit_logs_target_user_id_idx
  on public.access_audit_logs (target_user_id);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id);

create index if not exists cms_posts_created_by_idx
  on public.cms_posts (created_by);

create index if not exists cms_posts_updated_by_idx
  on public.cms_posts (updated_by);

create index if not exists dominican_datasets_source_id_idx
  on public.dominican_datasets (source_id);

create index if not exists dominican_economic_indicators_source_id_idx
  on public.dominican_economic_indicators (source_id);

create index if not exists dominican_geo_layers_source_id_idx
  on public.dominican_geo_layers (source_id);

create index if not exists dominican_institutions_source_id_idx
  on public.dominican_institutions (source_id);

create index if not exists dominican_policy_documents_source_id_idx
  on public.dominican_policy_documents (source_id);

create index if not exists dominican_procurement_records_source_id_idx
  on public.dominican_procurement_records (source_id);

create index if not exists dominican_signals_source_id_idx
  on public.dominican_signals (source_id);

create index if not exists dominican_sync_runs_source_id_idx
  on public.dominican_sync_runs (source_id);

create index if not exists workspace_events_related_task_id_idx
  on public.workspace_events (related_task_id);

create index if not exists workspace_form_responses_respondent_id_idx
  on public.workspace_form_responses (respondent_id);

create index if not exists workspace_forms_creator_id_idx
  on public.workspace_forms (creator_id);

create index if not exists workspace_notification_queue_related_event_id_idx
  on public.workspace_notification_queue (related_event_id);

create index if not exists workspace_notification_queue_related_task_id_idx
  on public.workspace_notification_queue (related_task_id);

create index if not exists workspace_prospect_activities_actor_id_idx
  on public.workspace_prospect_activities (actor_id);

create index if not exists workspace_prospect_emails_actor_id_idx
  on public.workspace_prospect_emails (actor_id);

create index if not exists workspace_prospect_emails_template_id_idx
  on public.workspace_prospect_emails (template_id);

create index if not exists workspace_prospect_templates_creator_id_idx
  on public.workspace_prospect_templates (creator_id);

create index if not exists workspace_prospects_creator_id_idx
  on public.workspace_prospects (creator_id);

create index if not exists workspace_tasks_created_by_idx
  on public.workspace_tasks (created_by);
