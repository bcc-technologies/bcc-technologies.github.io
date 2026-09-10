# Science Radar: piloto de oportunidades MAP-Nano

Estado al 9 de septiembre de 2026: la migración está aplicada en Supabase, el flag del piloto está activado y publicado en producción, y la muestra independiente de 60 papers está congelada. Falta comprobar el flujo de creación de fichas con una sesión autenticada real (primera validación en producción) y no hay etiquetas humanas ni métricas de precisión independientes todavía.

## Qué permite

- Crear una ficha desde un paper, desde los papers de una señal, o desde el archivo. Se parte de una candidata; aceptar una señal no valida una oportunidad.
- Registrar problema, usuario objetivo, aporte de BCC, hipótesis comprobable y siguiente acción. Añadir responsable, fecha de revisión, verificación de fuentes/derechos, motivo y resultado.
- Buscar títulos, filtrar estados y encontrar revisiones vencidas o previstas para hoy, con paginación de 30 fichas en el servidor.
- Conservar una copia del resumen, metadatos y URL de hasta 20 papers. El servidor captura esa evidencia desde el corpus; no confía en evidencia enviada por el navegador.
- Consultar revisiones anteriores y exportar la ficha con el historial cargado. La exportación declara si el historial está completo; las revisiones antiguas se cargan por bloques de 30.

Pasar a `validating` exige responsable y fecha; pasar a `validated` exige además motivo, resultado y notas de verificación. Rechazar o archivar exige motivo. Estas reglas obligan a documentar la decisión: no verifican que una afirmación humana sea cierta.

## Arquitectura y límites

`intelligence_opportunities` contiene la versión actual; `intelligence_opportunity_history` conserva las revisiones completas. El generador de señales no escribe en estas tablas. El RPC `save_intelligence_opportunity` valida permisos, bloquea la fila, comprueba la revisión esperada y guarda ficha e historial en una única transacción.

Los clientes autenticados con permiso `department:manage` pueden leer mediante RLS. No tienen escritura directa en las tablas; el RPC delega a una función privada con permisos controlados. El actor se deriva de `auth.uid()`. La protección frente a manipulación es para los clientes de la aplicación; no es un registro inmune a cambios por un administrador de base de datos.

Las ediciones conservan la evidencia anterior salvo recaptura explícita. Recapturar puede cambiar la selección actual, pero las revisiones anteriores conservan sus propias copias. Un conflicto o fallo no borra el formulario. El historial conserva versiones, no sustituye copias de seguridad.

El piloto captura papers, no páginas completas, datasets, licencias ni retractaciones automáticamente. El responsable es texto libre; no envía notificaciones. El selector usa el corpus ya cargado por el dashboard y la evidencia existente en la ficha. La línea inicial es MAP-Nano, con el mismo esquema reutilizable para otras líneas. Las pistas de la auditoría siguen en [candidatas](science-radar-candidates-2026-09-07.md); no se insertaron como oportunidades validadas.

## Activación

1. **Completado:** migración aditiva aplicada al proyecto `bglkyqiqzrcwegpjrucc` con versión remota `20260907213407`. El archivo canónico es `supabase/migrations/20260907213407_intelligence_opportunity_dossiers.sql`, alineado con esa versión: dos tablas, índices, políticas de lectura y RPC de escritura; no cambia las tablas existentes.
2. **Verificación parcial en producción:** catálogo confirma RLS, políticas limitadas a gestores, lectura autenticada sin escritura directa, ausencia de acceso anónimo y los permisos correctos del RPC. Las huellas de ambas funciones coinciden exactamente con la migración probada localmente. El conector no permite `SET ROLE authenticated` ni ejecutar el RPC restringido: la prueba transaccional no llegó a crear fichas. Se confirmaron cero fichas y cero revisiones.
3. **Completado (9 de septiembre de 2026):** `window.BCC_SCIENCE_RADAR_PILOT_ENABLED = true` en `js/supabase-config.js`, publicado a producción. Panel y botones de Oportunidades visibles para usuarios con `department:manage`. La prueba end-to-end con una sesión autenticada real (crear y guardar una ficha desde el panel) todavía no se ha hecho; queda como primera validación en producción, no como bloqueo previo a la publicación — decisión explícita del usuario.

Los advisors no reportaron avisos de seguridad sobre las nuevas tablas o funciones. En rendimiento aparece únicamente el [índice todavía sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperable con tablas recién creadas y vacías. Hay avisos sobre otros componentes del proyecto; este cambio no constituye una auditoría de esos componentes. No hubo commit, push ni publicación del sitio.

## Evaluación independiente

El nuevo evaluador separa predicciones congeladas de etiquetas humanas. Rechaza IDs reutilizados de la muestra de ajuste y registra huellas SHA-256 del código, corpus, predicciones y exclusiones. Las etiquetas se completan en un archivo separado. Una huella detecta modificaciones accidentales; no es una firma de autenticidad ni demuestra ausencia de sesgo del revisor.

La extracción autorizada de 60 papers distintos de los 115 usados en el ajuste se completó. Corpus, predicciones, plantilla de revisión y manifest están en `server-data/science-radar/evaluations/20260907/`, excluido de Git. La selección ordenó por `md5(id::text || 'map-nano-holdout-20260907')` dentro de publicaciones del 7 de septiembre de 2025 al 7 de septiembre de 2026, excluyendo todos los IDs de calibración. Se usó únicamente el tópico Nano y se deshabilitó cualquier interpretación temporal del muestreo. Los títulos y resúmenes nuevos no se inspeccionaron para ajustar el motor.

La muestra congelada contiene 60 etiquetas pendientes. El informe mantiene precisión y recall en `null`. SHA-256 del archivo `frozen.json`: `5ab50a180469d360ea6445b86de44854d1cb7a4e3c12f28b21aa818b2e766539`. Huella del motor: `2816859e77b84424817977b739409130b133687e928ccba1f0d3ba681afa601f`. Entregar solamente `review.json` al revisor; `frozen.json` contiene las selecciones del motor. No usar los 115 como prueba de generalización.

Para futuras muestras, preparar el corpus con la forma interna del sincronizador (`papers`, `topics`, `now` fijo; campos de papers en camelCase), y ejecutar:

```powershell
node scripts/evaluate-intelligence.mjs prepare corpus-independiente.json muestra-usada.json directorio-nuevo
node scripts/evaluate-intelligence.mjs report directorio-nuevo/frozen.json directorio-nuevo/review.json
```

`muestra-usada.json` admite el snapshot anterior con `papers` o una lista completa de IDs que se hayan inspeccionado para ajustar reglas. Mantener el corpus interno y los resultados fuera de Git. Entregar únicamente `review.json` al revisor: marcar cada caso `yes`, `no` o `uncertain`, con motivo y nombre del revisor. La pregunta es si merece una siguiente acción concreta de BCC/MAP-Nano, no si comparte palabras clave. Verificar las fuentes antes de resolver casos dudosos.

El informe no calcula precisión ni recall hasta resolver etiquetas pendientes e inciertas. Reporta precisión de papers seleccionados y proporción de papers útiles recuperados **dentro de esa muestra**. No mide éxito comercial, calidad de oportunidades, recuperación sobre toda la literatura ni tasas de crecimiento. Un resultado sin positivos o sin selecciones mantiene el cociente correspondiente en `null`. Tras usar esta muestra para cambiar reglas, pasa a ser calibración: la siguiente evaluación necesita nuevos documentos.

## Verificación realizada

- 87 pruebas de Intelligence, incluidas validación del evaluador, API y PostgreSQL real embebido con PGlite 0.5.8 (dependencia exclusiva de desarrollo).
- 279 pruebas totales sin fallos ni omisiones.
- PostgreSQL: denegación a anónimos/no gestores, lectura con RLS, prohibición de escritura directa, bloqueo de revisión obsoleta, motivos y resultados obligatorios, conservación/recaptura de evidencia e historial atómico.
- Navegador Chrome local con transporte simulado: creación desde paper, formulario requerido, guardado, historial, rechazo de URL insegura, conservación de borrador ante conflicto y ausencia de desbordamiento móvil. No prueba conectividad real con Supabase.
- Integridad de scripts y assets generados comprobada.

Para repetir las pruebas de base de datos y aplicación: `npm ci` y `npm run test:intelligence`. El resultado sólido es la persistencia y el control de cambios probados localmente. La mejora de precisión y el valor de negocio siguen sin medirse de forma independiente.
