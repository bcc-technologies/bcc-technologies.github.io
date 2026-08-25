update public.workspace_tasks
set
  importance = case priority
    when 'high' then 5
    when 'medium' then 3
    else 2
  end,
  urgency = case
    when status = 'done' then 1
    when due_date is not null and due_date <= current_date then 5
    when due_date is not null and due_date <= current_date + interval '2 days' then 4
    when due_date is not null and due_date <= current_date + interval '7 days' then 3
    when priority = 'high' then 3
    when priority = 'medium' then 3
    else 2
  end
where importance = 3 and urgency = 3;;
