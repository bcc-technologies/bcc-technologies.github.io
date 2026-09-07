# Auditoría de Science Radar — 7 de septiembre de 2026

## Dictamen

La infraestructura de ingesta es útil, pero la evaluación anterior confunde cantidad de información con oportunidad. Las puntuaciones altas no son una validación científica, comercial ni de elegibilidad. El archivo conserva estados, pero antes del cambio el sync podía sustituir la evidencia sobre la que se tomó una decisión.

Se auditó el código, los contratos del módulo y agregados de la base configurada en `supabase/config.toml`. Se hicieron cambios locales y pruebas; no se desplegó ni se modificaron registros de producción.

## Evidencia observada en producción

| Observación | Resultado | Implicación |
| --- | ---: | --- |
| Papers almacenados | 960 | El volumen por sí solo no demuestra utilidad. |
| Papers con fecha futura | 143 | El cálculo anterior los contaba como recientes. La fecha futura puede ser metadato editorial; no prueba que el paper sea falso. |
| Papers sin abstract | 142 | Limita la capacidad de evaluar el caso de uso. |
| Señales | 24 | Varias son resúmenes del mismo tema, no oportunidades independientes. |
| Proyectos financiados | 6 | NIH/NSF: última sincronización registrada el 22 de junio. |
| Patentes / ensayos | 0 / 0 | La ausencia no significa ausencia de competencia o validación. |
| Últimos ocho runs | 19 señales generadas por run | La métrica incluye señales regeneradas; no son necesariamente 19 hallazgos nuevos. |

MAP-Nano y MAP-Bio tenían señales con oportunidad 100/100. En sus desgloses aparecía espacio competitivo libre 100/100, aunque no había patentes. La muestra observada también otorgaba 100 a crecimiento, financiación y dolor técnico. Esto demuestra saturación de la heurística; no demuestra que todas las investigaciones vinculadas sean irrelevantes.

## Hallazgos y correcciones

1. **Coincidencias demasiado permisivas.** Se aceptaban subcadenas, coincidencias de media frase, afiliaciones y etiquetas derivadas como prueba de relevancia. Ahora hay coincidencia por palabras completas, frases configuradas y contenido del registro. Las etiquetas existentes ya no convierten automáticamente un resultado en coincidencia perfecta. La utilidad de keywords demasiado amplias todavía debe revisarse con BCC.

2. **Crecimiento sin línea base válida.** Había ventanas de 45 y 135 días, una línea base inventada y fechas futuras admitidas. Ahora se comparan ventanas iguales de 45 días, con al menos tres observaciones en cada una. Sin esa evidencia se declara que el crecimiento no está establecido. El análisis sigue describiendo una muestra indexada, no una tendencia del mercado completo.

3. **Premios por información ausente.** Sin patentes se otorgaba el máximo espacio competitivo; acceso abierto al artículo contaba como datos disponibles. Ahora el espacio competitivo es desconocido y no aporta puntos. Solo un enlace explícito a datos puede aportar disponibilidad de datos; los conectores actuales todavía no ofrecen una extracción validada de datasets y licencias.

4. **Financiación adjudicada presentada como convocatoria.** Los proyectos financiados y ensayos podían emitir `grant_opportunity`. Esa emisión se retiró: esas fuentes sirven para explorar colaboración. Detectar financiación solicitabile requiere un conector de convocatorias con plazo, entidad elegible, geografía y fuente primaria comprobados.

5. **Autoconfirmación del score.** La confianza dependía del propio score de oportunidad; la cercanía a BCC se inflaba con la descripción del tema. Ahora la confianza describe completitud y coincidencia de la evidencia, separada del interés estimado. El dolor técnico se promedia por documento y las afiliaciones sin enlace ya no cuentan como contactos accesibles. Sigue siendo una heurística, no una probabilidad calibrada.

6. **Cobertura desigual.** Se consultaban siempre los primeros temas y nunca los posteriores al octavo. Ahora rotan todos los habilitados, con un presupuesto por fuente y día. Sigue pendiente rotar también los keywords dentro de cada tema y evaluar la cobertura por fuente con métricas persistidas.

7. **Archivo mutable.** Se preservaba `status`, pero se sobrescribían evidencia, recomendación y puntuaciones. Ahora las señales aceptadas, rechazadas o archivadas permanecen sin cambios durante el sync. Para refrescarlas hay que devolverlas explícitamente a revisión. Las nuevas referencias guardan fecha y extracto además de título y URL. Esto no recupera versiones antiguas ya sobrescritas ni sustituye un historial completo de decisiones.

8. **Higiene que podía interferir con revisión humana.** El archivado automático incluía `reviewing` y podía actuar sobre una selección desactualizada. Ahora solo afecta `new`, vuelve a comprobar estado y umbrales al escribir, y cuenta filas realmente modificadas. La actualización de señales también vuelve a comprobar que sigan abiertas antes de escribir.

9. **Recuperación poco práctica.** La cola decía estar priorizada pero ordenaba por última actualización. Ahora usa la prioridad existente y añade filtros por estado, línea y texto, búsqueda en títulos de evidencia y exportación JSON de los resultados visibles. «Aceptadas» funciona como colección de oportunidades guardadas; «Archivadas» no implica que sean buenas oportunidades.

## Límites que siguen siendo importantes

- La generación aún agrega por tema y tipo. Un tema como MAP-Nano puede agrupar problemas distintos. El siguiente cambio estructural debe separar **evidencia → hipótesis concreta → oportunidad curada → experimento → resultado**. Identificar la oportunidad solo por título/tipo/línea no basta para ese flujo.
- La generación lee una muestra máxima de 300 papers y 200 registros por cada otra clase. Ahora excluye fechas futuras antes de tomar los 300 y expone el límite en su metodología. Falta paginación y selección equilibrada por tema; no se afirma cobertura completa.
- El panel carga hasta 500 señales. La búsqueda y exportación describen explícitamente ese alcance. Para un archivo mayor hacen falta búsqueda y paginación en servidor.
- El workflow diario sigue ejecutando papers. Grants, trials y patentes tienen acciones separadas; no debe confundirse «fuente habilitada» con «fuente sincronizada recientemente».
- Las señales antiguas que el nuevo motor deje de producir no se borran ni se invalidan retroactivamente. Se identifican como evaluación anterior en el detalle y requieren revisión. Un sync no es una migración automática de juicios históricos.
- No hay registro completo de autor, razón de decisión, responsable, próxima revisión, hipótesis falsable y resultado del experimento. Añadirlos requiere un contrato de curación y su esquema, no más texto en un score.
- No se evaluaron a fondo reproducibilidad, calidad metodológica, retractaciones, licencias de datos ni capacidad comercial de BCC. Tampoco se hizo una revisión visual del Science Radar autenticado; las pruebas del panel usan un DOM simulado.

## Validación y criterio para la siguiente fase

Las pruebas de regresión verifican casos concretos: subcadenas, etiquetas engañosas, fechas futuras, falta de línea base, acceso abierto sin datos, rotación de temas, conservación de expedientes, guardas ante cambios de estado y recuperación/exportación por evidencia. Pasaron 75 pruebas del módulo; la suite completa pasó 267 pruebas. El verificador de integridad pasó sobre 184 scripts y 347 archivos fuente.

**Actualización tras la autorización del usuario:** se compararon ambos motores sobre una muestra real de 115 papers y 6 proyectos financiados. El diagnóstico está en [Comparación sobre muestra autorizada](science-radar-benchmark-2026-09-07.md), y las pistas se conservaron en [Candidatas para revisión](science-radar-candidates-2026-09-07.md). La versión 2.1 corrige fallos adicionales encontrados en esa muestra. Sigue sin existir una evaluación independiente etiquetada por BCC que permita calcular precision@k, recall o una mejora porcentual real.

Una evaluación defendible debe usar una muestra etiquetada por BCC, separar oportunidades de producto, colaboración y financiación, y comparar ambos motores sobre exactamente los mismos registros. Medir precision@10, diversidad de temas, duplicados y tiempo para tomar una decisión. Recall requiere además un conjunto conocido de oportunidades que el radar debería encontrar. Conservar falsos positivos y falsos negativos como regresiones, y calibrar los umbrales con un conjunto distinto al de evaluación.

Prioridad siguiente: definir qué resultado útil cuenta para BCC; validar una muestra autorizada; diseñar el expediente de oportunidad con evidencia congelada y registro de decisiones; después ampliar cobertura y automatización. No añadir un LLM como sustituto de esos contratos y mediciones.
