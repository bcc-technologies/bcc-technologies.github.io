# UI administrativa de evaluaciones MAP

Esta guía describe la interfaz web para gestionar testers externos de la
**UserUI** de MAP. No es una interfaz de desarrollo de pipelines: los testers
son usuarios `client` y no reciben `map.dev.access`.

## Qué controla la UI

Una evaluación tiene esta jerarquía:

```text
Cuenta organizacional (laboratorio colaborador)
  └── Cohorte de evaluación (un producto, fechas, objetivo)
        └── Participantes (invitado, activo, completado o revocado)
              └── Licencia individual evaluation (una plaza, vencimiento)
```

Crear una cohorte para cada producto es intencional: `map.nano`, `map.bio` y
`map.med` pueden tener alcances, datos de prueba y reglas distintas. No mostrar
una opción genérica de “todos los productos”.

## Límite de acceso

La pantalla solo puede mostrarse como conveniencia cuando el usuario tiene
`platform.evaluations.manage`, pero el backend MAP repite esa comprobación. La UI
no es una frontera de seguridad.

No llames desde el navegador a estas tablas ni RPC de Supabase:

- `evaluation_cohorts`
- `evaluation_cohort_members`
- `evaluation_access_events`
- `platform_licenses`
- `create_evaluation_*`, `provision_evaluation_access` o
  `revoke_evaluation_access`

Sus permisos para `authenticated` están deliberadamente revocados. Tampoco
incluyas `SUPABASE_SERVICE_ROLE_KEY` en código, HTML, configuración pública ni
variables `VITE_*`. La clave de servicio solo existe en el backend MAP.

## Configuración web

Configura el origen del backend MAP fuera de código. Por ejemplo:

```html
<script>
  window.BCC_MAP_API_URL = "https://map.example.com";
</script>
```

En el backend MAP, añade el origen publicado de la web corporativa a
`CORS_ALLOWED_ORIGINS`. No uses el mismo `/api` relativo del sitio corporativo:
esa ruta pertenece a su servidor local de cuentas, no a MAP.

La UI obtiene el token de la sesión existente y lo reenvía al backend MAP:

```js
async function mapRequest(path, options = {}) {
  const supabase = await window.BCCAuth.loadSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Inicia sesión para continuar.");

  const baseUrl = String(window.BCC_MAP_API_URL || "").replace(/\/$/, "");
  if (!baseUrl) throw new Error("Falta BCC_MAP_API_URL.");

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.detail || "La operación no pudo completarse.");
  return body;
}
```

Antes de mostrar la navegación, usa `await window.BCCAuth.currentUser()` y
verifica `user.permissions.includes("platform.evaluations.manage")`. La función
`currentUser()` ya incorpora los permisos canónicos devueltos por
`get_my_platform_access()`.

## Contrato de API

Todos estos endpoints requieren el bearer token Supabase de personal autorizado
y la configuración servidor `SUPABASE_SERVICE_ROLE_KEY`.

### Cuentas y cohortes

```text
POST /api/admin/platform/evaluations/accounts
{ "displayName": "Laboratorio colaborador" }

GET /api/admin/platform/evaluations/cohorts

POST /api/admin/platform/evaluations/cohorts
{
  "accountId": "<uuid>",
  "productKey": "map.bio",
  "name": "Bio usability cohort — agosto 2026",
  "purpose": "Evaluar flujo de anotación y reporte.",
  "startsAt": "2026-08-01T00:00:00Z",
  "endsAt": "2026-08-31T23:59:59Z"
}
```

`startsAt`, `endsAt` y cualquier `endsAt` de participante deben incluir zona
horaria. La respuesta de listado contiene `cohort_id`, `account_name`,
`product_key`, `cohort_status`, fechas y contadores de participantes.

### Participantes

```text
GET /api/admin/platform/evaluations/cohorts/<cohortId>/participants

POST /api/admin/platform/evaluations/cohorts/<cohortId>/participants
{ "email": "tester@laboratorio.example", "fullName": "Nombre Apellido" }

POST /api/admin/platform/evaluations/cohorts/<cohortId>/participants
{ "userId": "<uuid de usuario Supabase>", "endsAt": "2026-08-20T23:59:59Z" }

POST /api/admin/platform/evaluations/cohorts/<cohortId>/participants/<userId>/revoke
{ "reason": "Fin de la prueba acordada" }
```

Envía **exactamente uno** de `email` o `userId` al crear un participante. Con
`email`, MAP invita al usuario y lo deja `invited`; el primer inicio de sesión
Supabase lo activa. Con `userId`, el participante ya existente queda `active`.

El listado de participantes contiene solo lo necesario para administración:
`user_id`, `email`, `display_name`, `member_status`, `access_status`,
`valid_until` y `license_id`. No mostrar ni registrar información científica en
esta vista.

## Diseño recomendado

1. **Vista de cohortes**: tabla con laboratorio, producto, propósito, fechas,
   estado y `activos / total`. Filtrar por producto y por “vigente”, sin ocultar
   cohortes vencidas: son parte de la trazabilidad.
2. **Detalle de cohorte**: participantes, su estado de acceso y vencimiento.
   Ofrecer “invitar” y “revocar”, con confirmación explícita para la revocación.
3. **Crear cohorte**: primero seleccionar o crear el laboratorio, luego un solo
   producto y un intervalo de tiempo. Mostrar que cada plaza es individual.
4. **Estados**:
   - `invited` / `pending`: invitación enviada, aún sin acceso.
   - `active`: puede usar la UserUI del producto de la cohorte.
   - `paused`, `expired`, `inactive`: informar; no simular que tiene acceso.
   - `revoked`: acceso retirado y licencia invalidada.
5. **No incluir** controles para convertir a staff, asignar permisos dev, ni
   editar directamente una licencia. Esas acciones pertenecen a otro ciclo de
   gobierno y no a un programa de testers.

No implementes todavía botones para pausar/cerrar una cohorte: el modelo tiene
esos estados para su ciclo de vida, pero la API actual expone alta, listado,
invitación y revocación. Presentar un control sin endpoint sería humo.

## Estado que ve el propio tester

`GET /api/auth/access` en MAP devuelve, para la sesión actual:

```json
{
  "permissions": ["map.workspace.access", "map.bio.use"],
  "evaluationCohorts": [{
    "cohortId": "...",
    "cohortName": "Bio usability cohort — agosto 2026",
    "productKey": "map.bio",
    "memberStatus": "active",
    "accessStatus": "active",
    "validUntil": "2026-08-31T23:59:59+00:00"
  }]
}
```

Úsalo para una nota discreta de programa y vencimiento, no para decisiones de
autorización. El backend comprueba la licencia, cohorte y participante en cada
token validado.

## Datos y dominios

- **Nano**: indicar límite de carga, ejecución y retención antes de abrir una
  cohorte; los archivos pueden ser pesados.
- **Bio**: mantener procedencia de la muestra y separar feedback de testers de
  las anotaciones/benchmarks canónicos.
- **Med**: usar solo datos sintéticos o correctamente desidentificados hasta
  contar con las salvaguardas y acuerdos apropiados.

Los archivos de la UserUI actual se aíslan por sesión de navegador en el caché
del backend MAP. No son todavía un workspace persistente multitenant. No
presentes la cohorte como un sistema de colaboración o almacenamiento compartido
de datos de laboratorio.

## Checklist de entrega

- [ ] La pantalla está oculta para quien no tenga `platform.evaluations.manage`.
- [ ] Cada petición usa el bearer token actual, nunca una clave de servicio.
- [ ] El backend MAP tiene el origen web permitido por CORS.
- [ ] Los formularios usan fechas con zona horaria.
- [ ] La revocación pide confirmación y muestra el resultado.
- [ ] Una invitación nueva aparece como pendiente hasta que su destinatario
      inicia sesión.
- [ ] Se prueban 403 (usuario normal), 400 (datos inválidos) y 503
      (configuración de administración ausente).

## Esquema y fuentes de verdad

La UI debe considerar estas migraciones como el contrato de datos:

- `supabase/migrations/20260715025508_evaluation_cohorts_and_lifecycle.sql`
- `supabase/migrations/20260715031301_evaluation_status_single_license.sql`
- `supabase/migrations/20260715032527_evaluation_administration_read_models.sql`

La documentación de migraciones también se mantiene en
`supabase/migrations/README.md`.
