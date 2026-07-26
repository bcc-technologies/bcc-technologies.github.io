# Workspace JavaScript modules

Shared dashboard modules live here. Page-level controllers remain in `js/dashboard.js` and `js/staff-dashboard.js`; domain controllers are mounted lazily through the feature registry.

- `events.js`: named event contracts, payload normalization and removable subscriptions.
- `module-runtime.js`: uniform mount, activate, abort and destroy lifecycle for lazy modules.
- `icons/registry.js` + `icons/catalogs/*.js`: registrable icon catalog ownership; `icons.js` is the renderer and stable facade.
- `utils.js`: shared formatting, escaping, labels, timeouts, message rendering and icon refresh helpers.
- `ui/registry.js` + `ui/{foundation,content,states,interactions}.js`: modular visual contracts; `ui.js` composes the stable `BCCWorkspaceUI` facade.
- `feature-registry.js`: declarative feature-to-view, permission, dependency, style and script contract; styles load before controllers and mounting is delegated to `module-runtime.js`.
- `transport.js`: shared request timeout, cancellation and stable transport-error boundary for operational repositories.
- `tasks-contracts.js`, `calendar-contracts.js`, `forms-contracts.js`: domain DTO normalization and domain-specific error translation.
- `tasks-repository.js`, `calendar-repository.js`, `forms-repository.js`: routes and commands for operational data; UI controllers never consume transport envelopes.
- `map-contracts.js`: canonical MAP products, statuses, DTO normalization and domain errors.
- `map-repository.js`: the only dashboard boundary for authenticated MAP RPC queries and commands.
- `account.js`: shared account menu, profile form, permissions list and email manager behavior.
- `shell.js`: shared workspace sidebar, collapse, mobile drawer and search behavior. Use `data-workspace-searchable` for new searchable dashboard actions.
- `router.js`: shared hash/view router with aliases, active nav state and optional panel targeting.
- `forms.js`: workspace forms module.
- `productivity.js`: private tasks and KPI module.
- `calendar.js`: operational calendar view subscribed to workspace tasks.
- `admin-access-contracts.js`, `admin-access-repository.js`, `admin-access-state.js`, `admin-access-view.js`: shared administrative access domain boundary and state.
- `admin-users.js`, `admin-roles.js`, `admin-audit.js`: independent lifecycle controllers for the three administrative views.
- `analytics.js`: admin analytics module.
- `intelligence.js`: technology/scientific intelligence module.
- `prospects.constants.js`, `prospects.layout.js`, `prospects.api.js`, `prospects.js`: prospect CRM constants, shell layout, API boundary and state/render controller.

## Shared contract rules

- `shared/access-contracts.json` is the canonical role, permission, hierarchy and label manifest. Run `node scripts/render-access-contracts.mjs` after editing it; `--check` verifies drift.
- Browser controllers consume effective permissions through `window.BCCAccessContracts.canAccess`; server-side authorization remains authoritative.
- New lazy modules implement `init(context)`, optional `activate(context)`, and optional `destroy(context)`. The compatibility adapter in `feature-registry.js` preserves existing `init(user, context)` modules during migration.
- Feature CSS is declared with `styles` in `feature-registry.js` and loaded before scripts. A feature style points to a manifest in `css/workspace/features/`; controllers never append stylesheets themselves.
- Compound features declare independent `mounts` in `feature-registry.js`. Navigation uses `transition()` so inactive roots abort pending work and finish teardown before they can mount again.
- Workspace events must be declared in `events.js`; modules use `emit` and `subscribe` instead of raw document event names.
- Domain DTOs and commands remain inside their domain contracts and repositories; they do not belong in a generic common module.
- Controllers never call `BCCAuth.api`, serialize request bodies or unpack API envelopes. Repositories own routes and commands; contracts return normalized domain values.
- Repository requests accept an `AbortSignal`. `transport.js` applies the shared timeout and `auth-workspace-api.js` propagates its signal to Supabase query builders.
