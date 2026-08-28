alter table public.workspace_prospects add column if not exists owner_label text not null default '';
alter table public.workspace_prospects add column if not exists assignment_status text not null default 'unassigned';
alter table public.workspace_prospects add column if not exists assignment_note text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workspace_prospects_owner_label_check') then
    alter table public.workspace_prospects
      add constraint workspace_prospects_owner_label_check
      check (char_length(owner_label) <= 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workspace_prospects_assignment_status_check') then
    alter table public.workspace_prospects
      add constraint workspace_prospects_assignment_status_check
      check (assignment_status in ('unassigned', 'assigned', 'accepted', 'declined', 'needs_reassignment'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workspace_prospects_assignment_note_check') then
    alter table public.workspace_prospects
      add constraint workspace_prospects_assignment_note_check
      check (char_length(assignment_note) <= 240);
  end if;
end;
$$;

create index if not exists workspace_prospects_assignment_idx
on public.workspace_prospects (assignment_status, owner_label, updated_at desc);;
