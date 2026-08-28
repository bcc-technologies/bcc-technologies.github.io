-- Allow named-user tester licenses to stay on each participant's individual account.
create or replace function private.validate_evaluation_license()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cohort_row public.evaluation_cohorts%rowtype;
  plan_product_key text;
  plan_is_evaluation boolean;
begin
  if new.evaluation_cohort_id is null then return new; end if;
  select * into cohort_row from public.evaluation_cohorts
  where id = new.evaluation_cohort_id for key share;
  if not found then raise exception 'The evaluation cohort does not exist'; end if;

  select plan.product_key, license_type.is_evaluation
  into plan_product_key, plan_is_evaluation
  from public.license_plans plan
  join public.license_types license_type on license_type.key = plan.license_type_key
  where plan.id = new.plan_id;
  if plan_product_key is distinct from cohort_row.product_key
    or coalesce(plan_is_evaluation, false) is false then
    raise exception 'An evaluation license must use the cohort product evaluation plan';
  end if;

  if new.account_id is distinct from cohort_row.account_id and not exists (
    select 1 from public.license_accounts account
    join public.evaluation_cohort_members member
      on member.user_id = account.individual_owner_id
    where account.id = new.account_id
      and account.account_kind = 'individual'
      and account.status = 'active'
      and member.cohort_id = cohort_row.id
  ) then
    raise exception 'An evaluation license must belong to the cohort or participant account';
  end if;
  if new.institution_id is distinct from cohort_row.account_id then
    raise exception 'An evaluation license institution must match the cohort institution';
  end if;
  if new.seat_limit <> 1 then
    raise exception 'Evaluation licenses are named-user licenses with one seat';
  end if;
  if new.starts_at < cohort_row.starts_at or new.starts_at >= cohort_row.ends_at then
    raise exception 'The evaluation license starts outside the cohort window';
  end if;
  if new.ends_at is null or new.ends_at > cohort_row.ends_at then
    raise exception 'The evaluation license ends outside the cohort window';
  end if;
  if new.status = 'active' and cohort_row.status <> 'active' then
    raise exception 'Only active cohorts can issue active evaluation licenses';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_evaluation_license()
  from public, anon, authenticated;
drop trigger if exists validate_evaluation_license on public.platform_licenses;
create trigger validate_evaluation_license
before insert or update of account_id, plan_id, status, seat_limit, starts_at,
  ends_at, evaluation_cohort_id, institution_id
on public.platform_licenses
for each row execute function private.validate_evaluation_license();
