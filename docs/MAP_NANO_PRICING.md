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
- El dashboard persiste solicitudes de MAP-Nano mediante las RPCs autenticadas
  `create_my_map_nano_commercial_request`,
  `get_my_map_nano_commercial_requests` y
  `cancel_my_map_nano_commercial_request`. No publica la tabla de contactos.
- `map_nano_commercial_requests` tiene RLS de denegación directa, índices por
  solicitante/cuenta y un índice único parcial que impide que el mismo cambio
  permanezca abierto dos veces para una cuenta (o para un usuario sin cuenta).
- El historial se consulta desde el repositorio MAP, cubre otros dispositivos y
  permite cancelar una solicitud `pending` o `in_review`. Cancelarla libera la
  deduplicación para volver a enviar un alcance cambiado.
- El dashboard de staff incorpora la pestaña **Solicitudes** para
  `platform.licenses.manage`. La cola devuelve hasta 200 registros, permite
  filtrar y buscar, y registra una decisión `in_review`, `resolved` o
  `declined`; una nota es obligatoria al cerrar una solicitud.
- Formspree se conserva para el formulario público y los demás flujos MAP que
  todavía no tienen un backend comercial; el dashboard no lo usa para duplicar
  una solicitud MAP-Nano persistida.

Las migraciones remotas `20260728041132_map_nano_commercial_requests`,
`20260728041359_fix_map_nano_commercial_request_create_rpc`,
`20260728042221_remove_unused_map_nano_request_manager_helper` y
`20260728043321_map_nano_commercial_request_staff_queue` contienen el contrato
de persistencia y revisión. La segunda corrige una ambigüedad detectada en la
verificación transaccional de la primera; no dejó registros de prueba.

## Permisos

Los propietarios y administradores de cuentas organizacionales pueden iniciar
solicitudes de cambio en el dashboard. Los demás miembros ven el plan y una
acción para contactar al administrador o a soporte. Las solicitudes de una
nueva licencia sin organización activa siguen disponibles; no modifican una
cuenta existente.

La gestión de plazas sigue utilizando exclusivamente las RPCs de autoservicio
existentes.

La cola comercial usa `get_my_map_nano_commercial_request_queue` y
`review_my_map_nano_commercial_request`. Ambas verifican la identidad y
`platform.licenses.manage` en una función privada; la tabla y los contactos no
se publican para usuarios autenticados ni anónimos.

## Rutas y componentes

- Página pública: [`/map-nano-pricing.html`](../map-nano-pricing.html)
- Página de producto enlazada: [`/product_maps_nano.html`](../product_maps_nano.html)
- Dashboard: [`/dashboard.html#licencias`](../dashboard.html)
- Dashboard de staff: [`/staff-dashboard.html#maps-licensing/commercial`](../staff-dashboard.html)
- Render público: [`js/map-nano-pricing.js`](../js/map-nano-pricing.js)
- Estilos públicos: [`css/pages/map-nano-pricing.css`](../css/pages/map-nano-pricing.css)
- Módulo de dashboard: [`js/workspace/client-map-licenses.js`](../js/workspace/client-map-licenses.js)

La página de precios tiene tarjetas, comparación accesible con alternativa en
móvil, MAP-Nano Project, retorno económico prudente y FAQ. El dashboard añade
el resumen de plan, el estado vacío honesto, las capacidades técnicas recibidas
por el backend y formularios de solicitud.

## Calculadora de ahorro y retorno

La calculadora pública está en
[`/map-nano-pricing.html#savings-calculator`](../map-nano-pricing.html#savings-calculator).
Se renderiza mediante [`js/map-nano-savings-calculator.js`](../js/map-nano-savings-calculator.js),
que expone `window.BCCMapNanoSavingsCalculator.render(root, options)` para que
pueda reutilizarse sin duplicar la interfaz. La página pública la inicializa con
`context: "public"`; el dashboard no muestra una segunda calculadora.

La matemática vive separada en
[`js/map-nano-savings.js`](../js/map-nano-savings.js). Su función pura
`BCCMapNanoSavings.calculate(input)` conserva precisión interna y devuelve las
imágenes anuales, minutos y horas ahorradas, valor bruto, costo anual, ahorro
neto, ROI, recuperación y punto de equilibrio. El modelo es:

```text
imágenes anuales = imágenes/mes × meses de operación
horas ahorradas = imágenes anuales × (minutos actuales − minutos con MAP-Nano) / 60
ahorro bruto = horas ahorradas × costo efectivo/hora + costos sustituibles declarados
ahorro neto = ahorro bruto − costo anual del plan
ROI = ahorro neto / costo anual del plan × 100
```

Los reprocesos sólo se suman cuando el usuario los activa. Si el tiempo con
MAP-Nano es mayor, o el volumen/costo es bajo, la calculadora conserva el
resultado negativo; no fuerza un escenario favorable. Tampoco calcula ROI,
recuperación o equilibrio cuando el precio, el ahorro mensual o el valor por
imagen no son válidos. Institutional queda en **Requiere cotización** hasta que
el usuario escriba una estimación de precio.

Los precios no se duplican: Essential, Professional y Facility se leen de
`BCCMapNanoPlans.PLANS`; Institutional usa `annualPrice: null` y no toma su
precio inicial como si fuera una cotización cerrada. Los valores iniciales son
Professional, 50 imágenes/mes, 12 meses, 40 minutos actuales, 10 minutos con
MAP-Nano y US$25/h. Los presets editables viven en `PRESETS` dentro del
componente: `small`, `active` y `facility`.

La calculadora no añade una librería de gráficos. El repositorio no tenía
infraestructura de visualización reutilizable y una tabla comparativa accesible
entre Essential, Professional y Facility comunica el mismo punto de equilibrio
sin introducir una dependencia nueva.

El enlace de escenario usa parámetros `calc_*` de URL, normalizados al cargar,
sin datos personales. Al abrir una CTA, [`js/contact-context.js`](../js/contact-context.js)
adjunta esos datos como `savings_estimate_*` al formulario público y los
identifica como una estimación proporcionada por el usuario; no se guardan como
hechos financieros verificados. Para ajustar fórmulas, modifica sólo
`map-nano-savings.js`; para presets, copy, campos o CTA, modifica
`map-nano-savings-calculator.js`.

Pruebas de cálculo e integración estática:

```bash
node --test tests/map-nano-savings.test.mjs
```

Cubren el escenario Professional base, volumen cero, sin diferencia de tiempo,
MAP-Nano más lento, costo/hora cero, precios del catálogo, Institutional,
reprocesos y costos sustituibles.

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
