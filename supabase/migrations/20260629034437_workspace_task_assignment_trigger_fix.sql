create or replace function public.set_workspace_task_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    if new.assignment_mode = 'self' then
      new.user_id := auth.uid();
      new.assignee_id := auth.uid();
      new.assignment_status := 'accepted';
    else
      new.assignee_id := coalesce(new.assignee_id, new.user_id);
      new.user_id := new.assignee_id;
      if new.assignment_mode = 'assigned' then
        new.assignment_status := 'accepted';
      elsif new.assignment_mode = 'suggested' then
        new.assignment_status := 'pending';
      end if;
    end if;

    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
    return new;
  end if;

  new.updated_at := now();
  new.user_id := old.user_id;
  new.assignee_id := old.assignee_id;
  new.created_by := old.created_by;
  new.assignment_mode := old.assignment_mode;

  if new.assignment_status is distinct from old.assignment_status then
    if old.assignment_mode = 'suggested'
      and old.assignment_status = 'pending'
      and auth.uid() = old.assignee_id
      and new.assignment_status in ('accepted', 'rejected') then
      new.responded_at := now();
    else
      new.assignment_status := old.assignment_status;
      new.responded_at := old.responded_at;
    end if;
  end if;

  if new.status = 'done' and (old.status is distinct from 'done' or new.completed_at is null) then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_tasks_set_timestamps on public.workspace_tasks;
create trigger workspace_tasks_set_timestamps
before insert or update on public.workspace_tasks
for each row execute function public.set_workspace_task_timestamps();;
