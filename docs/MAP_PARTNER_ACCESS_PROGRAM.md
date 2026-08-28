# Programa de acceso aliado para MAP

Estado local: implementado y cubierto por pruebas de contrato. La migración y
la Edge Function deben desplegarse y validarse contra el proyecto Supabase
remoto antes de operar con clientes reales.

## Objetivo

Administrar acceso gratuito y temporal a la UserUI de MAP sin convertir a un
tester externo en personal BCC y sin confundir una cortesía con una licencia
comercial pendiente de cobro.

El programa conserva la jerarquía existente:

```text
Cuenta organizacional
  └── Programa/cohorte por producto
        └── Participante
              └── Licencia evaluation individual y revocable
```

## Tipos de programa

- `standard_evaluation`: evaluación estándar de producto.
- `partner_test`: testers pertenecientes a un cliente o laboratorio aliado.
- `complimentary_pilot`: piloto gratuito aprobado expresamente por BCC.

Los programas `partner_test` y `complimentary_pilot` requieren una
justificación escrita. Cada cohorte registra además:

- responsable o sponsor BCC;
- persona que aprobó la concesión;
- fecha opcional de revisión;
- cantidad máxima de renovaciones;
- cantidad de renovaciones consumidas.

La fuente de verdad está en
`supabase/migrations/20260825112036_partner_access_programs_and_invitations.sql`.

## Invitación de participantes

La UI administrativa invoca `invite-map-evaluation-participant`. La Edge
Function:

1. valida el origen HTTP;
2. valida el JWT con `auth.getUser()`;
3. comprueba en Postgres que el operador pueda administrar licencias;
4. reutiliza la cuenta si el correo ya existe;
5. usa `auth.admin.inviteUserByEmail()` si el correo es nuevo;
6. provisiona una licencia individual mediante la RPC de servicio existente;
7. devuelve si el correo fue enviado y si el acceso quedó `invited` o `active`.

La `SUPABASE_SERVICE_ROLE_KEY` vive únicamente en la Edge Function. No se
incluye en JavaScript del navegador, HTML ni configuración pública.

Al abrir el dashboard cliente, el repositorio invoca de forma idempotente
`activate_my_evaluation_memberships()` antes de leer el acceso efectivo. Así,
aceptar la invitación y entrar con la cuenta convierte la membresía pendiente
en activa sin concederle esa capacidad al operador ni al navegador anónimo.

## Variables y configuración

La función requiere secretos de Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BCC_SITE_URL`

Opcionales:

- `BCC_MAP_ADMIN_ALLOWED_ORIGINS`: orígenes adicionales separados por coma.
- `BCC_MAP_INVITE_REDIRECT_URL`: destino explícito después de aceptar la
  invitación. Si se omite, se usa el callback del sitio hacia Licencias MAP.

El destino de invitación también debe estar permitido en la configuración de
redirect URLs de Supabase Auth.

## Despliegue

Antes de usar comandos, consultar `supabase --help` y la ayuda del subcomando
instalado. El orden operativo es:

1. vincular la CLI con el proyecto correcto;
2. revisar la lista local/remota de migraciones;
3. aplicar la nueva migración;
4. configurar los secretos;
5. desplegar `invite-map-evaluation-participant` con verificación JWT;
6. ejecutar los advisors de seguridad y rendimiento disponibles en la versión
   instalada de la CLI;
7. completar la aceptación end-to-end siguiente.

No activar el botón para personal real si la migración o la Edge Function no
están desplegadas. Una UI visible sin su autoridad remota sería humo.

## Aceptación end-to-end obligatoria

### Operador autorizado

- Crear una cohorte `partner_test` para `map.nano`.
- Confirmar que motivo, sponsor, aprobación, revisión y renovaciones reaparecen
  al recargar el dashboard.
- Invitar un correo que todavía no exista.
- Confirmar recepción del email y estado `invited`.
- Completar el alta e iniciar sesión.
- Confirmar estado `active` y capacidades `map.workspace.access` y
  `map.nano.use`.

### Cuenta existente

- Agregar un usuario BCC existente.
- Confirmar que no se duplica la cuenta ni la licencia.
- Confirmar que el reintento es idempotente.

### Seguridad y ciclo de vida

- Usuario cliente normal: la invitación debe responder 403.
- JWT ausente o vencido: debe responder 401.
- Cohorte vencida, pausada o cerrada: no debe provisionar acceso.
- Revocar al participante: el acceso efectivo debe desaparecer.
- Alcanzar `ends_at`: MAP-Nano debe responder 403 aunque la sesión siga abierta.
- Confirmar que ninguna respuesta o log contiene la clave de servicio.

## Límite de este repositorio

Este sitio administra y presenta la autoridad de acceso, pero no contiene el
runtime de análisis de MAP-Nano. El backend de MAP-Nano debe consultar la
autoridad canónica y comprobar licencia, asignación, cohorte, participante y
fechas en cada operación protegida. Mostrar el permiso en el dashboard no es
suficiente.

Tampoco se incluyen aún alertas automáticas de revisión/vencimiento ni una
operación para consumir renovaciones. Los campos ya existen para incorporar
esas dos extensiones sin volver a cambiar el modelo conceptual.
