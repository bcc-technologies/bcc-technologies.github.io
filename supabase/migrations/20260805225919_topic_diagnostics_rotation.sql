alter table public.intelligence_papers
  add column if not exists topics_checked_at timestamptz;

create index if not exists intelligence_papers_topics_checked_idx
on public.intelligence_papers (topics_checked_at nulls first);
;
