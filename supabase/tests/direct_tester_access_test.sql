BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions, private, auth, pg_temp;
SELECT plan(6);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '92000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'map-direct-actor@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"MAP Direct Test Actor"}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '92000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'map-direct-tester@example.test', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Direct Access Tester"}'::jsonb, now(), now()
  );

INSERT INTO public.platform_user_roles (user_id, role_key, source, granted_by)
VALUES (
  '92000000-0000-4000-8000-000000000001',
  'internal.license.manager',
  'manual',
  '92000000-0000-4000-8000-000000000001'
);

SELECT lives_ok(
  $call$
    SELECT * FROM private.provision_tester_access(
      null,
      null,
      '92000000-0000-4000-8000-000000000002',
      'active',
      'map.nano',
      null,
      now() + interval '30 days',
      'Direct independent tester access for the database regression test.',
      now() + interval '15 days',
      '92000000-0000-4000-8000-000000000001'
    )
  $call$,
  'provisions direct tester access without an institution or cohort'
);

SELECT ok(
  (
    SELECT account.account_kind = 'individual'
      AND license.source = 'evaluation'
      AND license.evaluation_cohort_id IS NULL
      AND license.institution_id IS NULL
      AND license.access_program_type = 'partner_test'
      AND license.seat_limit = 1
    FROM public.platform_licenses license
    JOIN public.license_accounts account ON account.id = license.account_id
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    WHERE assignment.user_id = '92000000-0000-4000-8000-000000000002'
      AND assignment.unassigned_at IS NULL
  ),
  'keeps direct tester access individually owned and explicitly governed'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '92000000-0000-4000-8000-000000000002',
  true
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM private.get_current_platform_access()
    WHERE access_source = 'license'
      AND product_key = 'map.nano'
  ),
  'grants MAP-Nano entitlement through the direct tester license'
);

SELECT lives_ok(
  $call$
    SELECT * FROM private.provision_tester_access(
      null,
      null,
      '92000000-0000-4000-8000-000000000002',
      'active',
      'map.nano',
      null,
      now() + interval '30 days',
      'Direct independent tester access for the database regression test.',
      now() + interval '15 days',
      '92000000-0000-4000-8000-000000000001'
    )
  $call$,
  'accepts an idempotent retry for direct tester access'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.platform_licenses license
    JOIN public.license_assignments assignment ON assignment.license_id = license.id
    JOIN public.license_plans plan ON plan.id = license.plan_id
    WHERE assignment.user_id = '92000000-0000-4000-8000-000000000002'
      AND assignment.unassigned_at IS NULL
      AND license.status = 'active'
      AND plan.product_key = 'map.nano'
  ),
  1::bigint,
  'does not duplicate direct tester access on retry'
);

SELECT throws_ok(
  $insert$
    INSERT INTO public.platform_licenses (
      account_id, plan_id, status, source, seat_limit, starts_at, ends_at,
      issued_by, evaluation_cohort_id, access_program_type
    )
    SELECT
      account.id, plan.id, 'active', 'evaluation', 1, now(),
      now() + interval '30 days',
      '92000000-0000-4000-8000-000000000001', null,
      'standard_evaluation'
    FROM public.license_accounts account
    CROSS JOIN LATERAL (
      SELECT candidate.id
      FROM public.license_plans candidate
      JOIN public.license_types license_type
        ON license_type.key = candidate.license_type_key
      WHERE candidate.product_key = 'map.nano'
        AND candidate.is_active
        AND license_type.is_evaluation
      LIMIT 1
    ) plan
    WHERE account.individual_owner_id = '92000000-0000-4000-8000-000000000002'
  $insert$,
  '23514',
  'new row for relation "platform_licenses" violates check constraint "platform_licenses_evaluation_source_check"',
  'rejects generic evaluation licenses without a cohort'
);

SELECT * FROM finish();
ROLLBACK;
