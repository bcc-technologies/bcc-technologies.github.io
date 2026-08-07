-- Lets the sync distinguish signals it swept into "archived" for being stale
-- and low-value from ones a human explicitly archived, so the review UI can
-- show that distinction instead of looking identical.
alter table public.intelligence_signals
  add column if not exists auto_archived boolean not null default false;
