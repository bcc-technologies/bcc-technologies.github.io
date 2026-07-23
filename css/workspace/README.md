# Workspace CSS modules

`css/pages/dashboard.css` is the ordered manifest for dashboard styles. Keep new dashboard styles in this directory by responsibility:

- `workspace-core.css`: shared layout primitives, shell tokens, filters, tables and activity feeds.
- `workspace-shell.css`: structural dashboard shell layout and desktop/mobile placement.
- `workspace-shell-experience.css`: shell interaction states such as mobile scroll locking, auxiliary footer disclosure and collapse affordances.
- `workspace-sidebar.css`: the sole owner of navigation geometry, hierarchy, row alignment, active states and collapsed navigation visuals.
- `workspace-intelligence-analytics.css`: analytics and intelligence views.
- `workspace-components.css`: shared surfaces, intros, actions, metrics, priority cards, status lists and resource rows.
- `workspace-account.css`: account, profile, email and security surfaces.
- `workspace-access.css`: admin access drawer, preview and confirmation surfaces.
- `workspace-licenses.css`: administrative MAP license list, detail drawer, creation dialog and responsive states.
- `workspace-prospects.css`: prospect CRM pipeline, forms, emails and timeline.
- `workspace-productivity.css`: tasks, boards and KPI reporting.
- `workspace-calendar.css`: operational calendar derived from workspace tasks.
- `workspace-forms.css`: form builder and response inbox.
- `workspace-customer.css`: customer dashboard skin. Use workspace variables; do not restyle shell chrome.
- `workspace-internal.css`: staff/admin dashboard skin. Use workspace variables; do not restyle shell chrome.
- `workspace-roles.css`: admin role and permission management.

Navigation invariants: sidebar rows span the available width, hierarchy only indents row content, labels are explicitly left aligned, and tree guides are positioned independently from buttons.
