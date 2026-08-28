create table if not exists public.account_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  is_primary boolean not null default false,
  is_confirmed boolean not null default false,
  confirmation_token text not null default '',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create unique index if not exists account_emails_user_email_key
on public.account_emails (user_id, email);

create unique index if not exists account_emails_email_key
on public.account_emails (email);

create unique index if not exists account_emails_one_primary_per_user
on public.account_emails (user_id)
where is_primary;

alter table public.account_emails enable row level security;

revoke all on public.account_emails from public, anon, authenticated;
grant select (id, user_id, email, is_primary, is_confirmed, created_at, confirmed_at) on public.account_emails to authenticated;
grant insert (user_id, email, is_primary, is_confirmed, confirmation_token, confirmed_at) on public.account_emails to authenticated;

drop policy if exists "Users can read own account emails" on public.account_emails;
create policy "Users can read own account emails"
on public.account_emails
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can add own account emails" on public.account_emails;
create policy "Users can add own account emails"
on public.account_emails
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    (is_primary = false and is_confirmed = false)
    or (is_primary = true and is_confirmed = true and email = lower(coalesce(auth.jwt()->>'email', '')))
  )
);

create or replace function private.confirm_account_email(target_email text, token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.account_emails
  set is_confirmed = true,
      confirmation_token = '',
      confirmed_at = now()
  where user_id = auth.uid()
    and email = lower(trim(target_email))
    and is_confirmed = false
    and confirmation_token = token
    and confirmation_token <> '';

  if not found then
    raise exception 'Codigo de confirmacion invalido';
  end if;
end;
$$;

create or replace function private.set_primary_account_email(target_email_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_email text;
begin
  select email into target_email
  from public.account_emails
  where id = target_email_id
    and user_id = auth.uid()
    and is_confirmed = true;

  if target_email is null then
    raise exception 'Confirma el correo antes de hacerlo principal';
  end if;

  update public.account_emails
  set is_primary = false
  where user_id = auth.uid();

  update public.account_emails
  set is_primary = true
  where id = target_email_id
    and user_id = auth.uid();

  update public.profiles
  set email = target_email,
      updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function private.delete_account_email(target_email_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.account_emails
  where id = target_email_id
    and user_id = auth.uid()
    and is_primary = false;

  if not found then
    raise exception 'No puedes eliminar el correo principal';
  end if;
end;
$$;

create or replace function public.confirm_account_email(target_email text, token text)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.confirm_account_email(target_email, token);
$$;

create or replace function public.set_primary_account_email(target_email_id uuid)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.set_primary_account_email(target_email_id);
$$;

create or replace function public.delete_account_email(target_email_id uuid)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.delete_account_email(target_email_id);
$$;

revoke all on function private.confirm_account_email(text, text) from public, anon, authenticated;
grant execute on function private.confirm_account_email(text, text) to authenticated, service_role;
revoke all on function private.set_primary_account_email(uuid) from public, anon, authenticated;
grant execute on function private.set_primary_account_email(uuid) to authenticated, service_role;
revoke all on function private.delete_account_email(uuid) from public, anon, authenticated;
grant execute on function private.delete_account_email(uuid) to authenticated, service_role;
revoke all on function public.confirm_account_email(text, text) from public, anon;
grant execute on function public.confirm_account_email(text, text) to authenticated;
revoke all on function public.set_primary_account_email(uuid) from public, anon;
grant execute on function public.set_primary_account_email(uuid) to authenticated;
revoke all on function public.delete_account_email(uuid) from public, anon;
grant execute on function public.delete_account_email(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := coalesce(meta->>'full_name', meta->>'name', '');
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    first_name,
    middle_names,
    first_last_name,
    second_last_name,
    display_name,
    company,
    title,
    role,
    staff_roles,
    departments
  )
  values (
    new.id,
    coalesce(new.email, ''),
    name,
    coalesce(meta->>'first_name', split_part(name, ' ', 1), ''),
    coalesce(meta->>'middle_names', ''),
    coalesce(meta->>'first_last_name', ''),
    coalesce(meta->>'second_last_name', ''),
    coalesce(meta->>'display_name', split_part(name, ' ', 1), ''),
    coalesce(meta->>'company', ''),
    coalesce(meta->>'title', ''),
    'client',
    '{}',
    '{}'
  )
  on conflict (id) do nothing;

  insert into public.account_emails (
    user_id,
    email,
    is_primary,
    is_confirmed,
    confirmation_token,
    confirmed_at
  )
  values (
    new.id,
    lower(coalesce(new.email, '')),
    true,
    true,
    '',
    now()
  )
  on conflict (user_id, email) do update
  set is_primary = true,
      is_confirmed = true,
      confirmation_token = '',
      confirmed_at = coalesce(public.account_emails.confirmed_at, now());

  return new;
exception
  when others then
    raise warning 'profiles insert failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

insert into public.account_emails (
  user_id,
  email,
  is_primary,
  is_confirmed,
  confirmation_token,
  confirmed_at
)
select
  id,
  lower(email),
  true,
  true,
  '',
  now()
from public.profiles
where coalesce(email, '') <> ''
on conflict (user_id, email) do update
set is_primary = true,
    is_confirmed = true,
    confirmation_token = '',
    confirmed_at = coalesce(public.account_emails.confirmed_at, now());

notify pgrst, 'reload schema';;
