# MAP-Nano: precios, planes y licencias

## Fuente comercial única

[`js/map-nano-plans.js`](../js/map-nano-plans.js) es la única fuente de la
oferta comercial de MAP-Nano. Contiene:

- precios anuales numéricos en USD y su formato `en-US`;
- equivalentes mensuales derivados, nunca escritos en los componentes;
- público objetivo, copy, CTA y límites por plan;
- entitlements comerciales y la matriz de comparación;
- MAP-Nano Project, separado de los cuatro planes anuales;
- la traducción prudente de estados de licencia para la interfaz.

Para cambiar un precio, una función, un límite de usuarios o instalaciones, se
edita ese archivo. Para añadir un plan, agrega su objeto a `PLANS` y, si debe
aparecer en la comparación, ajusta sus `entitlements`. Las vistas pública y de
cliente consumen el mismo catálogo.

## Límites y entitlements

Los entitlements de `map-nano-plans.js` describen la propuesta comercial
(`batch_processing`, `audit_logs`, `api_access`, etc.). No son autorización.

La autorización efectiva continúa en Supabase: `license_plans`,
`license_plan_capabilities`, `platform_licenses` y `license_assignments`. Los
RPCs existentes calculan `get_my_platform_access()` a partir de la identidad
autenticada; el dashboard muestra esas capacidades reales cuando las recibe.
No se debe autorizar funcionalidad con comparaciones como
`plan === "professional"`.

Los contratos de navegación y de datos de navegador se mantienen en:

- [`js/workspace/map-contracts.js`](../js/workspace/map-contracts.js)
- [`js/workspace/map-repository.js`](../js/workspace/map-repository.js)

El segundo conserva el límite entre la interfaz y los RPCs. No hay acceso
directo a tablas de licencias desde el navegador.

## Estado de licencia, facturación y organización

El dashboard usa datos reales de `get_my_license_dashboard()` para cuenta,
organización, inicio, vencimiento, plazas, asignaciones y estado de la
licencia. Si el backend no entrega un dato, la UI muestra “No especificado”; no
lo convierte en cero ni inventa fechas o facturas.

El backend actual no expone facturas, método de pago, historial de suscripción
ni una clave comercial `Essential`/`Professional`/`Facility`/`Institutional`.
Por eso una licencia existente cuyo `plan_name` no coincide con esos nombres se
muestra como plan no reconocido o como el nombre real recibido. Para enlazar
planes emitidos con el catálogo, una futura migración deberá añadir una clave
comercial estable a la respuesta del RPC, sin retirar los planes heredados.

## Solicitudes comerciales

No hay checkout de Stripe, Paddle u otra pasarela en este repositorio. Todas
las CTA de planes abren una solicitud; ninguna simula una compra o emite una
licencia.

- La página pública lleva `product=map-nano`, `plan` e `intent` a
  [`contactUs.html`](../contactUs.html).
- [`js/contact-context.js`](../js/contact-context.js) amplía el formulario de
  contacto existente con institución, país, usuarios estimados, volumen y tipo
  de solicitud cuando llega un plan MAP-Nano.
- El dashboard envía el formulario enriquecido al endpoint Formspree ya usado
  por BCC. Sólo confirma éxito tras una respuesta HTTP correcta.
- Para evitar reenvíos accidentales, el dashboard guarda localmente la marca
  no sensible de una solicitud aceptada por Formspree durante 45 días para ese
  plan y navegador. Esto no es un historial canónico ni cubre otros
  dispositivos.

La dependencia pendiente es un backend de solicitudes comerciales con una
entidad, estado y lectura por organización. Cuando exista, se debe reemplazar
ese marcador local por un adaptador del repositorio MAP que persista y consulte
solicitudes mediante RPCs con RLS. Entonces se podrán ofrecer historial,
cancelación/edición y prevención de duplicados entre dispositivos.

## Permisos

Los propietarios y administradores de cuentas organizacionales pueden iniciar
solicitudes de cambio en el dashboard. Los demás miembros ven el plan y una
acción para contactar al administrador o a soporte. Las solicitudes de una
nueva licencia sin organización activa siguen disponibles; no modifican una
cuenta existente.

La gestión de plazas sigue utilizando exclusivamente las RPCs de autoservicio
existentes.

## Rutas y componentes

- Página pública: [`/map-nano-pricing.html`](../map-nano-pricing.html)
- Página de producto enlazada: [`/product_maps_nano.html`](../product_maps_nano.html)
- Dashboard: [`/dashboard.html#licencias`](../dashboard.html)
- Render público: [`js/map-nano-pricing.js`](../js/map-nano-pricing.js)
- Estilos públicos: [`css/pages/map-nano-pricing.css`](../css/pages/map-nano-pricing.css)
- Módulo de dashboard: [`js/workspace/client-map-licenses.js`](../js/workspace/client-map-licenses.js)

La página de precios tiene tarjetas, comparación accesible con alternativa en
móvil, MAP-Nano Project, retorno económico prudente y FAQ. El dashboard añade
el resumen de plan, el estado vacío honesto, las capacidades técnicas recibidas
por el backend y formularios de solicitud.

## Analítica

Se reutiliza `window.BCCAnalytics` cuando está disponible. Se registran, sin
datos sensibles, `pricing_page_viewed`, `pricing_plan_selected`,
`pricing_comparison_opened`, `pricing_faq_opened`, `subscription_page_viewed`,
`quote_requested`, `project_access_requested`, `upgrade_requested` y
`contact_sales_clicked`.

## Decisiones comerciales aún abiertas

- la política académica final;
- la política definitiva de instalaciones asociadas a Professional;
- el modelo contractual exacto para usuarios nominativos y concurrentes;
- la definición técnica y contractual de despliegue local, API y LIMS;
- facturación, impuestos, renovación y cualquier integración de pagos;
- la entidad canónica para solicitudes e historial comercial.
