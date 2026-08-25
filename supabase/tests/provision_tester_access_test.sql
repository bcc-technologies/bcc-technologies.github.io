BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions, private, auth, pg_temp;
SELECT plan(11);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'map-test-actor@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"MAP Test Actor"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'map-test-explicit@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Explicit Expiry Tester"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'map-test-inherited@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Inherited Expiry Tester"}'::jsonb, now(), now()
  );

INSERT INTO public.platform_user_roles (user_id, role_key, source, granted_by)
VALUES (
  '91000000-0000-4000-8000-000000000001',
  'internal.license.manager',
  'manual',
  '91000000-0000-4000-8000-000000000001'
);

INSERT INTO public.license_accounts (id, account_kind, display_name)
VALUES (
  '91000000-0000-4000-8000-000000000010',
  'organization',
  'MAP Transaction Test Institution'
);

INSERT INTO public.evaluation_cohorts (
  id, account_id, product_key, name, purpose, status, starts_at, ends_at,
  created_by, program_type, grant_reason, sponsored_by, approved_by,
  review_at, max_renewals
) VALUES (
  '91000000-0000-4000-8000-000000000020',
  '91000000-0000-4000-8000-000000000010',
  'map.nano',
  'MAP Transaction Test Cohort',
  'Verify tester access provisioning transactionally.',
  'active',
  now() - interval '1 day',
  now() + interval '90 days',
  '91000000-0000-4000-8000-000000000001',
  'partner_test',
  'Transactional grant used only by the MAP database test.',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  now() + interval '60 days',
  1
);

SELECT lives_ok(
  $call$
    SELECT * FROM private.provision_tester_access(
      '91000000-0000-4000-8000-000000000010',
      '91000000-0000-4000-8000-000000000020',
      '91000000-0000-4000-8000-000000000002',
      'active',
      null,
      null,
      now() + interval '30 days',
      '',
      null,
      '91000000-0000-4000-8000-000000000001'
    )
  $call$,
  'provisions cohort tester access with an explicit individual expiry'
);

SELECT is(
  (
    SELECT account.account_kind
    FROM public.platform_licenses license
    JOIN public.license_accounts account ON account.id = license.account_id
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    WHERE assignment.user_id = '91000000-0000-4000-8000-000000000002'
      AND assignment.unassigned_at IS NULL
  ),
  'individual'::text,
  'keeps the tester license on the individual account'
);

SELECT ok(
  (
    SELECT license.institution_id = '91000000-0000-4000-8000-000000000010'
      AND license.evaluation_cohort_id = '91000000-0000-4000-8000-000000000020'
    FROM public.platform_licenses license
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    WHERE assignment.user_id = '91000000-0000-4000-8000-000000000002'
      AND assignment.unassigned_at IS NULL
  ),
  'retains the institutional and cohort scope'
);

SELECT is(
  (
    SELECT license.ends_at
    FROM public.platform_licenses license
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    WHERE assignment.user_id = '91000000-0000-4000-8000-000000000002'
      AND assignment.unassigned_at IS NULL
  ),
  now() + interval '30 days',
  'uses the explicit individual expiry'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.license_account_members
    WHERE account_id = '91000000-0000-4000-8000-000000000010'
      AND user_id = '91000000-0000-4000-8000-000000000002'
      AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1
    FROM public.evaluation_cohort_members
    WHERE cohort_id = '91000000-0000-4000-8000-000000000020'
      AND user_id = '91000000-0000-4000-8000-000000000002'
      AND status = 'active'
      AND revoked_at IS NULL
  ),
  'activates the institutional and cohort memberships'
);

SELECT lives_ok(
  $call$
    SELECT * FROM private.provision_tester_access(
      '91000000-0000-4000-8000-000000000010',
      '91000000-0000-4000-8000-000000000020',
      '91000000-0000-4000-8000-000000000003',
      'active',
      null,
      null,
      null,
      '',
      null,
      '91000000-0000-4000-8000-000000000001'
    )
  $call$,
  'provisions cohort tester access without an individual expiry'
);

SELECT is(
  (
    SELECT license.ends_at
    FROM public.platform_licenses license
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    WHERE assignment.user_id = '91000000-0000-4000-8000-000000000003'
      AND assignment.unassigned_at IS NULL
  ),
  (SELECT ends_at FROM public.evaluation_cohorts
    WHERE id = '91000000-0000-4000-8000-000000000020'),
  'inherits the cohort expiry when no individual expiry is supplied'
);

SELECT lives_ok(
  $call$
    SELECT * FROM private.provision_tester_access(
      '91000000-0000-4000-8000-000000000010',
      '91000000-0000-4000-8000-000000000020',
      '91000000-0000-4000-8000-000000000002',
      'active',
      null,
      null,
      now() + interval '30 days',
      '',
      null,
      '91000000-0000-4000-8000-000000000001'
    )
  $call$,
  'accepts an idempotent retry for the same tester scope'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.platform_licenses license
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    JOIN public.license_plans plan ON plan.id = license.plan_id
    WHERE assignment.user_id = '91000000-0000-4000-8000-000000000002'
      AND assignment.unassigned_at IS NULL
      AND license.status = 'active'
      AND plan.product_key = 'map.nano'
  ),
  1::bigint,
  'does not duplicate the active tester license on retry'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.evaluation_access_events
    WHERE user_id = '91000000-0000-4000-8000-000000000002'
      AND event_type = 'license_issued'
  ),
  1::bigint,
  'records one license-issued event'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.evaluation_access_events
    WHERE user_id = '91000000-0000-4000-8000-000000000002'
      AND event_type = 'participant_activated'
  ),
  1::bigint,
  'records one participant-activated event'
);

SELECT * FROM finish();
ROLLBACK;
