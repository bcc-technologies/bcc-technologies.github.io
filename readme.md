# BCC Technologies website

La página principal vive en los archivos `index.html` y `en/index.html`.
Los assets y recursos multimedia están en `static/`.

## Flujo de productos

La página de productos ya no se mantiene duplicando HTML a mano. La fuente compartida está en `js/products-content.js` y el HTML de `products.html` / `en/products.html` se genera con `scripts/render-products-pages.mjs`.

Comandos útiles:

- `npm run render:products`: regenera `products.html` y `en/products.html` desde `js/products-content.js`.
- `npm run check:products`: falla si el HTML generado no está sincronizado con la fuente compartida.
- `npm run test:products`: corre las regresiones DOM de productos.
- `npm run test:products:browser`: smoke test real en navegador para ES/EN desktop/mobile. Requiere Chrome o Edge instalado, o `CHROME_PATH`.
- `npm run test`: corre toda la suite local, incluyendo el smoke test de navegador cuando hay browser disponible.
- `npm run test:ci`: suite estable para CI, sin depender del browser smoke.

## Regla práctica

Si cambias `js/products-content.js`, corre al menos:

```bash
npm run render:products
npm run check:products
npm run test:products
```

Y si quieres validar layout/interacción real de `products`, añade:

```bash
npm run test:products:browser
```
