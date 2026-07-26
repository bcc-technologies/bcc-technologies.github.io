# Workspace visual architecture

Dashboard styles use an explicit cascade and page-specific entrypoints:

- `css/pages/dashboard-client.css`: foundations, shared shell, client skin and navigation.
- `css/pages/dashboard-staff.css`: foundations, shared shell, staff skin and navigation.
- `css/pages/maps-developer.css`: standalone developer-access page; it does not load the dashboard bundle.
- `css/workspace/features/*.css`: small manifests loaded on first activation by the feature registry.

## Cascade contract

Both dashboard entrypoints declare the same ordered layers:

1. `bcc.tokens`, `bcc.base`, `bcc.layout`, `bcc.components`
2. `workspace.core`, `workspace.shell`, `workspace.primitives`, `workspace.account`
3. `workspace.skin`
4. `workspace.features`
5. `workspace.navigation`
6. `workspace.experience`

Do not rely on HTML link order or unlayered overrides. Feature manifests must import their domain stylesheet with `layer(workspace.features)`. Shared shell styles never import feature CSS.

## Ownership

- `workspace-core.css`: fallback workspace geometry, shared filters, tables and activity feeds.
- `workspace-shell.css`: page grid, header/content placement, desktop/mobile shell and collapsed shell state.
- `workspace-components.css`: public manifest for `primitives/{icons,content,states,interactions,layers,compositions}.css`; consumers depend on the manifest, not internal files.
- `workspace-account.css`: exclusive owner of account layout, profile, email, security and account-menu controls.
- `workspace-sidebar.css`: final navigation geometry, hierarchy, row alignment, help surface and collapsed navigation visuals.
- `workspace-shell-experience.css`: interaction-only states such as mobile scroll locking, disclosure and collapse affordances.
- `workspace-customer.css` and `workspace-internal.css`: page skins. They may set workspace variables but must not own shell geometry.
- Domain files such as `workspace-prospects.css`, `workspace-productivity.css` and `workspace-maps-licensing.css`: feature-only visuals loaded through `css/workspace/features/`.

Navigation invariants: rows span the rail, hierarchy only indents content, labels remain left aligned, and tree guides are independent from button geometry.
