-- Restrict workspace_prospect_templates.category to a fixed taxonomy instead
-- of free text, to avoid the same fragmentation problem free-text owner
-- labels had (e.g. "Seguimiento" vs "seguimiento" counted as different
-- filters). Table is empty in production, so no backfill is needed.

alter table public.workspace_prospect_templates
  drop constraint if exists workspace_prospect_templates_category_check;

alter table public.workspace_prospect_templates
  add constraint workspace_prospect_templates_category_check
  check (category in ('', 'first_contact', 'follow_up', 'proposal', 'negotiation', 'reactivation', 'closing', 'internal'));
;
