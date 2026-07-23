# Supabase migrations

This directory is the canonical, ordered schema history from the MAP platform-access phase onward.

The earlier SQL files under `resources/` document historic manual deployments. They remain useful for audit and recovery, but new database changes must be added here, applied through the Supabase migration workflow, and verified against the linked project before any application code relies on them.

`20260715020645_platform_access_and_licensing.sql` is additive. It preserves `profiles.role` as a compatibility input while moving MAP authorization to normalized internal roles and commercial entitlements.

`20260715025508_evaluation_cohorts_and_lifecycle.sql` adds the controlled
UserUI evaluation layer. Cohorts are product-specific, time-bounded, and tied
to an organization account. Participant activation, status lookup, issuance,
and revocation are exposed only through scoped RPCs; they do not grant MAP
developer access or direct table access to testers.

`20260715031301_evaluation_status_single_license.sql` keeps the status RPC to
one current result per cohort when a tester's expired evaluation is renewed.

`20260715032527_evaluation_administration_read_models.sql` adds the
service-role-only read models used by the MAP backend to list cohorts and their
participants. Browser clients still have no direct table or RPC access.

`20260715041001_platform_access_governance_and_admin.sql` separates developer
access from license administration, adds least-privilege platform roles,
completes foreign-key indexes and exposes service-role-only operations for
licenses, assignments, permissions and operational analytics.

`20260715041320_platform_staff_role_assignments.sql` makes license-manager and
product-analyst access assignable through the existing audited staff profile
workflow.

The website-side implementation guide is
[`docs/MAP_EVALUATION_ADMIN_UI.md`](../../docs/MAP_EVALUATION_ADMIN_UI.md).
