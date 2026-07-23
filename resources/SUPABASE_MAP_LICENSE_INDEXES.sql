-- Cover MAP foreign keys used by referential actions and audit queries.
-- Prerequisites: SUPABASE_MAP_LICENSES.sql and
-- SUPABASE_MAP_LICENSE_ASSIGNMENTS.sql.

create index if not exists map_licenses_created_by_idx
  on public.map_licenses (created_by);

create index if not exists map_license_entitlements_product_idx
  on public.map_license_entitlements (product_id);

create index if not exists map_license_events_actor_idx
  on public.map_license_events (actor_id);

create index if not exists map_license_assignments_assigned_by_idx
  on public.map_license_assignments (assigned_by);
