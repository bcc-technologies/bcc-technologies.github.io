alter table public.workspace_tasks
  add column if not exists importance integer not null default 3,
  add column if not exists urgency integer not null default 3;

do $$
begin
  alter table public.workspace_tasks
    add constraint workspace_tasks_importance_check check (importance between 1 and 5);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.workspace_tasks
    add constraint workspace_tasks_urgency_check check (urgency between 1 and 5);
exception when duplicate_object then null;
end $$;

create index if not exists workspace_tasks_user_matrix_idx
on public.workspace_tasks (user_id, status, importance desc, urgency desc, created_at desc);;
