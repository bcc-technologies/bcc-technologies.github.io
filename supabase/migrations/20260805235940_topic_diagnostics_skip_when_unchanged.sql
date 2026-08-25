alter table public.intelligence_settings
  add column if not exists topics_diagnostics_last_run_at timestamptz;
;
