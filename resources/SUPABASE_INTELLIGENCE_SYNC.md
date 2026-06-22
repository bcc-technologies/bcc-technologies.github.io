## Intelligence Sync desde el Dashboard

La vista `Intelligence` del dashboard ahora puede:

1. Leer `sources`, `papers`, `topics`, `signals`, `runs`, `grants`, `patents` e `institutions` desde Supabase.
2. Disparar manualmente el workflow de sincronización desde el dashboard.
3. Ejecutar en `dry-run`.
4. Correr de forma programada por GitHub Actions.

### 0. Actualizar el esquema de runs

Vuelve a correr:

```text
resources/SUPABASE_WORKSPACE_INTELLIGENCE.sql
```

La tabla `intelligence_runs` ahora registra:

- `action_type`
- `dry_run`

### 1. Desplegar la Edge Function

```bash
supabase functions deploy run-intelligence-sync
```

### 2. Configurar secretos en Supabase

```bash
supabase secrets set \
  GITHUB_WORKFLOW_TOKEN=tu_github_pat \
  GITHUB_REPO_OWNER=tu_org_o_usuario \
  GITHUB_REPO_NAME=bcc-technologies.github.io \
  GITHUB_INTELLIGENCE_WORKFLOW_FILE=run-intelligence-sync.yml \
  GITHUB_INTELLIGENCE_WORKFLOW_REF=main
```

### 3. Configurar secretos en GitHub Actions

En el repo, agrega estos secretos:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENALEX_API_KEY
OPENALEX_EMAIL
SEMANTIC_SCHOLAR_API_KEY
NCBI_API_KEY
NIH_REPORTER_API_KEY
```

Solo `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son obligatorios para que el pipeline exista, pero para usar `OpenAlex` de forma normal ya conviene tratar `OPENALEX_API_KEY` como requerida.
`OPENALEX_EMAIL` sigue siendo opcional y sirve como identificación de contacto adicional.
`SEMANTIC_SCHOLAR_API_KEY` es opcional pero recomendable.
`NCBI_API_KEY` es opcional, pero muy recomendable si vas a usar `PubMed` de forma habitual.
`NIH_REPORTER_API_KEY` no es necesaria para la implementación actual de `NIH RePORTER`.
Las demás quedan preparadas para conectores futuros.

### 4. Qué hace el flujo

1. El admin pulsa `Run Intelligence Sync` u otra acción en `Intelligence`.
2. El dashboard llama la Edge Function `run-intelligence-sync`.
3. La Edge Function dispara `.github/workflows/run-intelligence-sync.yml`.
4. GitHub corre `node scripts/sync-intelligence.mjs`.
5. El script actualiza `intelligence_sources`, `intelligence_papers` e `intelligence_runs`.

### 5. Acciones disponibles

- `Run Intelligence Sync`
- `Fetch latest papers`
- `Fetch grants`
- `Fetch patents`
- `Generate signals`

En esta primera versión:

- `Run Intelligence Sync` sincroniza papers usando `enabled sources` y `enabled topics`, y luego genera señales por reglas heurísticas.
- `Fetch latest papers` sincroniza papers sin forzar generación posterior de señales.
- `Generate signals` usa `papers`, `grants`, `patents`, `institutions` y `topics` ya guardados en Supabase.
- `Fetch grants` ya funciona con `NIH RePORTER`.
- `Fetch patents` sigue respondiendo `not implemented yet`.

En la capa de `papers`, las fuentes activas actuales ya incluyen:
- `arXiv`
- `OpenAlex`
- `Crossref`
- `Semantic Scholar`
- `PubMed`

En la capa de `grants`, la fuente activa actual es:
- `NIH RePORTER`

### 6. Programación

El workflow `.github/workflows/run-intelligence-sync.yml` también corre por cron:

```text
17 6 * * *
```

Eso equivale a una ejecución diaria a las `06:17 UTC`.

### 7. Diseño recomendado para la cuota gratuita de OpenAlex

OpenAlex ya usa una cuota gratis basada en créditos con `api_key`.
Para no gastar esa cuota torpemente:

- Mantén `limit` bajo por fuente en runs normales, idealmente `20` a `50`.
- Usa `dry-run` primero para probar queries amplias.
- Evita disparar sync manual muchas veces seguidas con búsquedas full-text muy abiertas.
- Prefiere topics/keywords específicos frente a consultas genéricas.
- El workflow diario actual es razonable; no conviene subirlo a muchas ejecuciones por día sin necesidad.
- Si necesitas vigilar la cuota, usa el endpoint oficial `/rate-limit` de OpenAlex con tu key.

### 8. Si falla

- Verifica que la function exista: `run-intelligence-sync`
- Verifica los secretos en Supabase
- Verifica los secretos en GitHub Actions
- Verifica que el token tenga permiso `Actions: Read and write`
- Revisa los logs de la Edge Function y la página de Actions del repo

### 9. Seguridad y límites

- Solo `admins` pueden disparar el sync manual desde la Edge Function.
- Las API keys siguen viviendo solo en secretos de Supabase y GitHub Actions; no se exponen al frontend.
- No se guardan secretos en la base de datos de `Intelligence`.
- El sync manual tiene `rate limiting` básico para evitar ejecuciones consecutivas o solapadas.
- Las llamadas externas usan `timeout` y `retries` moderados.
- Los logs de error del pipeline intentan redactor tokens, bearer secrets y API keys antes de persistirlos o imprimirlos.
- La UI sanitiza texto al renderizar y restringe links externos a `http/https` con `rel="noopener noreferrer"`.
