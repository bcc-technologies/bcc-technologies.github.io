# AquaSpecter — logotipo

**Concepto.** Una gota (muestra líquida) que contiene la medición EIS completa:
la onda senoidal es la excitación AC y el semicírculo de puntos es la respuesta
de Nyquist sobre el eje de impedancia real (Z'). Lectura directa: *agua → señal → dato*.

## Archivos
| Uso | Archivo |
|---|---|
| Principal (fondo claro) | `svg/aquaspecter-horizontal.svg` |
| Fondo oscuro / banners | `svg/aquaspecter-horizontal-inverse.svg` |
| Una tinta (impresión, sellos) | `svg/aquaspecter-horizontal-mono.svg`, `-mono-white.svg` |
| Sin lema (espacios pequeños) | `svg/aquaspecter-horizontal-compact.svg` |
| Vertical (roll-up, portada) | `svg/aquaspecter-stacked.svg`, `-stacked-inverse.svg` |
| Isotipo (avatar, credencial) | `svg/aquaspecter-isotipo.svg`, `-isotipo-mono.svg` |

PNG a 4x en `png/`. Para imprenta usar siempre el SVG (vectorial; el texto está convertido a trazos, no depende de fuentes instaladas).

## Colores
| Nombre | HEX | Uso |
|---|---|---|
| Azul institucional | `#0B2A4A` | "Aqua", textos, fondos oscuros |
| Azul profundo | `#0E5E8C` | Base del degradado |
| Aqua | `#1FA3C6` | "Specter", acentos |
| Aqua claro | `#7FD3EA` | Acentos sobre fondo oscuro |

Tipografía: Montserrat 700 / 400 / 500 (SIL Open Font License).

## Reglas mínimas
- Área de respeto: la altura de la "A" alrededor de todo el logo.
- Tamaño mínimo: horizontal 40 mm (160 px); isotipo 8 mm (32 px). Bajo 60 mm usar la versión *compact*.
- No deformar, rotar, cambiar colores ni añadir sombras.

## Regenerar
`generate-logo.mjs` produce todos los SVG (requiere `opentype.js` y `@fontsource/montserrat`):
`node generate-logo.mjs <carpeta-salida>`
