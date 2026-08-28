do $$
declare
  target_user_id uuid;
  old_email constant text := 'bcctechrd@gmail.com';
  new_email constant text := 'enriquecasanova10@gmail.com';
begin
  select u.id into target_user_id
  from auth.users u
  where lower(u.email) = old_email
    and lower(u.email_change) = new_email
    and u.email_change_confirm_status = 1
    and coalesce(u.email_change_token_new, '') = ''
    and coalesce(u.email_change_token_current, '') <> ''
    and exists (
      select 1
      from public.account_emails ae
      where ae.user_id = u.id
        and lower(ae.email) = new_email
        and ae.is_confirmed = true
    );

  if target_user_id is null then
    raise exception 'Expected verified pending email-change state not found; no changes applied';
  end if;

  if exists (
    select 1 from auth.users
    where lower(email) = new_email and id <> target_user_id
  ) then
    raise exception 'Target email is already used by another Auth user';
  end if;

  update auth.users
  set email = new_email,
      email_change = '',
      email_change_token_new = '',
      email_change_token_current = '',
      email_change_confirm_status = 0,
      email_change_sent_at = null,
      raw_user_meta_data = jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{email}',
        to_jsonb(new_email),
        true
      ),
      updated_at = now()
  where id = target_user_id;

  update auth.identities
  set identity_data = jsonb_set(
        coalesce(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(new_email),
        true
      ),
      updated_at = now()
  where user_id = target_user_id
    and provider = 'email';
end;
$$;;
