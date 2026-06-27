# Workspace CSS modules

`css/pages/dashboard.css` is the ordered manifest for dashboard styles. Keep new dashboard styles in this directory by responsibility:

- `workspace-core.css`: shared layout primitives, shell tokens, filters, tables, metrics and activity feeds.
- `workspace-shell.css`: refined dashboard shell layout, protected topbar/brand/sidebar chrome and collapsed state.
- `workspace-intelligence-analytics.css`: analytics and intelligence views.
- `workspace-components.css`: shared dashboard components such as module surfaces, section headers, status pills, priority cards, account grids and compact resource rows.
- `workspace-account.css`: account, profile, email and security surfaces shared by client/staff dashboards.
- `workspace-access.css`: admin access drawer, access preview and confirmation surfaces.
- `workspace-prospects.css`: prospect CRM pipeline, forms, emails, timeline and prospect-specific responsive rules.
- `workspace-productivity.css`: tasks, boards and KPI reporting.
- `workspace-forms.css`: form builder and response inbox.
- `workspace-customer.css`: customer dashboard skin and content layout refinements. Use `.customer-workspace .workspace` variables for shell tone; do not restyle topbar, brand or sidebar directly here.
- `workspace-internal.css`: staff/admin dashboard skin and content layout refinements. Use `.staff-workspace .workspace` and `.admin-workspace .workspace` variables for shell tone; do not restyle topbar, brand or sidebar directly here.
- `workspace-roles.css`: admin role and permission management.
- `workspace-sidebar.css`: left navigation taxonomy, future items and collapsed states.
