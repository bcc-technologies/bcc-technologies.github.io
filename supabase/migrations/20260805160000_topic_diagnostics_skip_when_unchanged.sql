-- Lets scripts/sync-intelligence.mjs's runTopicDiagnostics() skip its whole
-- scan when no topic changed since the last time it ran. The scan exists to
-- catch papers whose topics no longer match the current topics config, so a
-- sync where nothing in intelligence_topics moved has nothing new to find --
-- it was still re-fetching up to 300 papers and re-running the matcher on
-- every single sync regardless.

alter table public.intelligence_settings
  add column if not exists topics_diagnostics_last_run_at timestamptz;
