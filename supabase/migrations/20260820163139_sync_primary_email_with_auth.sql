create or replace function private.set_primary_account_email(target_email_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_email text;
  canonical_email text;
begin
  select lower(trim(email)) into target_email
  from public.account_emails
  where id = target_email_id
    and user_id = auth.uid()
    and is_confirmed = true;

  if target_email is null then
    raise exception 'Confirma el correo antes de hacerlo principal';
  end if;

  select lower(trim(email)) into canonical_email
  from auth.users
  where id = auth.uid();

  if canonical_email is null then
    raise exception 'No se pudo verificar el correo de autenticacion';
  end if;

  -- A request to change the Auth email can require one or two confirmations.
  -- Do not promote the application-level primary email until Auth has
  -- actually adopted the target address.
  if target_email is distinct from canonical_email then
    return;
  end if;

  update public.account_emails
  set is_primary = false
  where user_id = auth.uid()
    and is_primary = true;

  update public.account_emails
  set is_primary = true,
      is_confirmed = true,
      confirmation_token = '',
      confirmed_at = coalesce(confirmed_at, now())
  where id = target_email_id
    and user_id = auth.uid();

  update public.profiles
  set email = canonical_email,
      updated_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function private.set_primary_account_email(uuid) from public, anon;
grant execute on function private.set_primary_account_email(uuid) to authenticated, service_role;

create or replace function private.sync_primary_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  canonical_email text := lower(trim(coalesce(new.email, '')));
begin
  if new.email is not distinct from old.email or canonical_email = '' then
    return new;
  end if;

  -- auth.users is the canonical identity. Mirror it only after GoTrue has
  -- completed the email-change flow.
  update public.account_emails
  set is_primary = false
  where user_id = new.id
    and is_primary = true;

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
    canonical_email,
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

  update public.profiles
  set email = canonical_email,
      updated_at = now()
  where id = new.id;

  return new;
exception
  when others then
    -- Never let an application mirror failure block an Auth identity change.
    raise warning 'primary email sync failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

revoke all on function private.sync_primary_email_from_auth() from public, anon, authenticated;
grant execute on function private.sync_primary_email_from_auth() to service_role;

drop trigger if exists sync_primary_email_after_auth_change on auth.users;
create trigger sync_primary_email_after_auth_change
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sync_primary_email_from_auth();;
