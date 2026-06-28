# Workspace JavaScript modules

Shared dashboard modules live here. Page-level controllers remain in `js/dashboard.js` and `js/staff-dashboard.js`; `js/admin-dashboard.js` now provides the internal management module mounted by staff.

- `icons.js`: local Lucide-compatible icon subset and renderer.
- `utils.js`: shared formatting, escaping, labels, timeouts, message rendering and icon refresh helpers.
- `account.js`: shared account menu, profile form, permissions list and email manager behavior.
- `shell.js`: shared workspace sidebar, collapse, mobile drawer and search behavior. Use `data-workspace-searchable` for new searchable dashboard actions.
- `router.js`: shared hash/view router with aliases, active nav state and optional panel targeting.
- `forms.js`: workspace forms module.
- `productivity.js`: private tasks and KPI module.
- `calendar.js`: operational calendar view subscribed to workspace tasks.
- `admin-dashboard.js`: internal management module for users, roles, audit and admin-only workspace sections.
- `analytics.js`: admin analytics module.
- `intelligence.js`: technology/scientific intelligence module.
- `prospects.constants.js`, `prospects.layout.js`, `prospects.api.js`, `prospects.js`: prospect CRM constants, shell layout, API boundary and state/render controller.
