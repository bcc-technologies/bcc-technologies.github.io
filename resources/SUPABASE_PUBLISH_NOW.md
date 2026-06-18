## Publicar Ahora desde el CMS

El boton `Publicar cambios` del CMS web ahora usa una Supabase Edge Function para disparar el workflow de GitHub que genera las paginas HTML del blog.

### 1. Desplegar la Edge Function

```bash
supabase functions deploy publish-blog-now
```

### 2. Configurar secretos en Supabase

```bash
supabase secrets set \
  GITHUB_WORKFLOW_TOKEN=tu_github_pat \
  GITHUB_REPO_OWNER=tu_org_o_usuario \
  GITHUB_REPO_NAME=bcc-technologies.github.io \
  GITHUB_BLOG_WORKFLOW_FILE=generate-supabase-blog.yml \
  GITHUB_BLOG_WORKFLOW_REF=main
```

### 3. Permisos del token de GitHub

Usa un token fino o PAT clasico con permiso para:

- `Actions: Read and write`
- `Contents: Read`

El token solo se usa dentro de la Edge Function. No se expone al navegador.

### 4. Que hace el flujo

1. El CMS guarda el post en `cms_posts`.
2. El boton `Publicar cambios` llama `publish-blog-now`.
3. La Edge Function dispara `.github/workflows/generate-supabase-blog.yml`.
4. GitHub genera `blog/*.html`, `en/blog/*.html` y `sitemap.xml`.

### 5. Si falla

- Verifica que la function exista: `publish-blog-now`
- Verifica los secretos en Supabase
- Verifica que el token tenga permiso de `Actions`
- Revisa el log de la Edge Function y la pagina de Actions del repo
