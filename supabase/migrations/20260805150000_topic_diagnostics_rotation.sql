-- The topic-diagnostics scan (scripts/sync-intelligence.mjs runTopicDiagnostics)
-- previously ordered candidates by updated_at desc. Since a repaired paper's
-- updated_at gets bumped to "now", that ordering kept re-selecting the same
-- recently-touched papers while ones nobody ever touched again sank further
-- behind and could go permanently unreachable once the corpus grew past the
-- scan's row limit. topics_checked_at lets the scan order by "oldest/never
-- checked first" instead, guaranteeing every paper eventually rotates through.

alter table public.intelligence_papers
  add column if not exists topics_checked_at timestamptz;

create index if not exists intelligence_papers_topics_checked_idx
on public.intelligence_papers (topics_checked_at nulls first);
