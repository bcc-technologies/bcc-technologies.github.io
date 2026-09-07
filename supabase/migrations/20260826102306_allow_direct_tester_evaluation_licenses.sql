alter table public.platform_licenses
  drop constraint if exists platform_licenses_evaluation_source_check;

alter table public.platform_licenses
  add constraint platform_licenses_evaluation_source_check
  check (
    (
      source = 'evaluation'
      and (
        evaluation_cohort_id is not null
        or access_program_type = 'partner_test'
      )
    )
    or (
      source <> 'evaluation'
      and evaluation_cohort_id is null
    )
  );
