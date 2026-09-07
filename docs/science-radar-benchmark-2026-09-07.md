# Science Radar: comparación sobre muestra autorizada

## Resultado

La muestra real confirmó que el motor anterior exageraba relevancia y oportunidad. También mostró que la primera corrección era insuficiente. La revisión posterior retiene pistas con incertidumbre explícita; no demuestra todavía una mejora porcentual de precisión comercial.

| Medida sobre el mismo conjunto | Original | Primera corrección 2.0 | Revisado 2.1 |
| --- | ---: | ---: | ---: |
| Señales generadas | 19 | 6 | 3 |
| Oportunidades de producto | 5 | 0 | 0 |
| Supuestas oportunidades de financiación | 4 | 0 | 0 |
| Tendencias de investigación | 5 | 0 | 0 |
| Colaboración | 4 | 2 | 1 |
| Ideas de contenido | 1 | 4 | 2 |
| Rango del índice de oportunidad | 80–100 | 2–30 | 12–23 |

Las tres señales finales referencian tres papers distintos. Dos señales comparten el mismo paper de análisis fractal: **tres señales no equivalen a tres oportunidades independientes**. Dos papers ya aparecían entre las referencias mostradas por el motor anterior; la pista de la red de microscopía industrial se recupera mediante el criterio de método en el título.

## Muestra y reproducibilidad

- Autorización explícita del usuario para leer los registros con abstracts.
- 115 papers y 6 proyectos financiados del mismo snapshot; 5 temas habilitados. No se aportaron patentes, ensayos ni instituciones enriquecidas a ninguno de los motores; la consulta de estas últimas devolvió una colección vacía.
- Selección determinista por `md5(id)` en cuatro estratos de fecha: 60 papers de los últimos 45 días, 30 de los 45 días anteriores, 15 de entre 90 y 365 días y 10 con fecha futura. Se solicitaron hasta 20 del tercer estrato; solo había 15.
- El reloj de evaluación se fijó a `1788800320012.98` milisegundos Unix para ambos motores.
- Original: `scripts/intelligence/signals.mjs` del commit `b0ca51822ccb2d2e9624e3b1edde422bb6daec5d`.
- Snapshot local SHA-256: `748d138e05ffc8b0b8154c707d378cf62d73c47c88ad211ea54b307d7f4d74dc`.
- Los registros y el script de reproducción quedaron en la carpeta temporal local `bcc-science-radar-audit-20260907`, fuera del repositorio. El repositorio contiene conclusiones y pruebas sintéticas, no una copia del corpus.

La muestra es estratificada para encontrar fallos, **no es representativa de la frecuencia temporal ni de todo el corpus**. Por eso el motor 2.1 no calcula crecimiento cuando se informa muestreo temporal incompleto o truncamiento de papers. Los valores antiguos sirven para observar su comportamiento; no son estimaciones válidas del crecimiento real.

## Errores encontrados al leer la evidencia

1. **La etiqueta «General» se convertía en relevancia científica.** Un documento llamado V-PRIMA entraba por expresiones genéricas y llegó a sobrevivir la primera corrección. Su abstract contiene afirmaciones extraordinarias, pero el radar no aportaba verificación que las sustentara. No es evidencia suficiente para recomendarlo. Se eliminaron los nombres genéricos de cartera como criterios científicos.

2. **Palabras separadas fabricaban una coincidencia.** Un sistema de corrección de postura en carreras entraba por palabras dispersas equivalentes a «scientific image analysis»; un trabajo de CT se asociaba a MAP-Med por una coincidencia incompleta. El matcher ahora mantiene campos y oraciones separados y limita la distancia entre palabras.

3. **Cell Counting Kit-8 no es conteo por imagen.** Estudios de mecanismos tumorales entraban por el nombre del ensayo. El fabricante describe CCK-8 como un ensayo colorimétrico de viabilidad celular. Se elimina únicamente ese nombre antes de buscar relevancia de imagen, conservando una mención independiente de conteo por imagen si existe. Fuente: [manual oficial de Dojindo](https://www.dojindo.com/manual/CK04/).

4. **Exigir solo las frases configuradas también pierde pistas útiles.** Se recuperaron métodos explícitos en títulos —microscopía electrónica industrial, análisis fractal de materiales, morfología superficial— como candidatas con origen documentado. Esas coincidencias no establecen demanda ni justifican por sí solas una oportunidad de producto.

## Archivo de candidatas

Las fichas están en [Candidatas para revisión](science-radar-candidates-2026-09-07.md). Conservan fuente, aplicación posible, incertidumbre y siguiente comprobación. La selección es un juicio provisional sobre abstracts y metadatos, no una evaluación de papers completos ni una aprobación de BCC.

## Qué permite concluir esta comparación

- Sí demuestra los fallos específicos de coincidencia, autoconfirmación y clasificación descritos arriba.
- Sí comprueba que las correcciones cambian los resultados sobre exactamente los mismos registros.
- No permite declarar «84% más preciso» por pasar de 19 a 3 señales. Menos resultados también puede significar perder oportunidades.
- No permite calcular precision@10 o recall: falta un conjunto etiquetado por BCC y una evaluación independiente.
- Las reglas 2.1 se ajustaron después de ver esta muestra. Este es un conjunto de diagnóstico y regresión, no un test independiente. La siguiente evaluación debe usar otra muestra reservada antes de ajustar reglas.
- Los cambios siguen siendo locales. Las señales históricas de producción no se sustituyeron ni se archivaron durante esta comparación.

La prueba de éxito siguiente debe ser recuperar candidatos concretos útiles para BCC, con poco ruido y evidencia verificable, y conservar también los falsos negativos detectados por revisión humana. No debe ser simplemente aumentar o disminuir el número de señales.

## Validación del cambio

Pasaron 80 pruebas de Intelligence y las 272 pruebas de la suite completa. El verificador de integridad pasó sobre 185 scripts y 348 archivos fuente. Las regresiones nuevas cubren nombres genéricos, coincidencias entre campos u oraciones, confusión con CCK-8, conservación de métodos en títulos y prohibición de inferir crecimiento de una muestra temporal no representativa.
