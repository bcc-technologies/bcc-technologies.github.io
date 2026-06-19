## Envio real de correos para Prospectos

El dashboard de `Prospectos` puede:

- enviar correos reales con `Guardar y enviar`,
- programar correos con `Guardar y programar`,
- adjuntar archivos remotos por URL,
- registrar cada envio en la timeline del prospecto.

### 1. Desplegar la Edge Function

```bash
supabase functions deploy send-prospect-email
```

### 2. Configurar secretos en Supabase

```bash
supabase secrets set \
  RESEND_API_KEY=tu_api_key \
  RESEND_FROM_EMAIL=ventas@tu-dominio.com \
  RESEND_FROM_NAME="BCC Technologies" \
  RESEND_REPLY_TO_EMAIL=contacto@tu-dominio.com
```

Notas:

- `RESEND_FROM_EMAIL` debe ser una direccion valida en un dominio configurado en Resend.
- `RESEND_REPLY_TO_EMAIL` es opcional.

### 3. Flujo de uso

1. Crear o abrir un prospecto.
2. Registrar un correo en borrador o aplicar una plantilla.
3. Para envio inmediato, usar `Guardar y enviar`.
4. Para envio diferido, usar `Guardar y programar` y definir `Programado para`.
5. La Edge Function envia el correo por Resend cuando es inmediato.
6. Si sale bien, el registro pasa a estado `sent`, guarda `provider_message_id`, actualiza `last_contact_at` y deja una actividad en la timeline.

### 4. Correos programados

Los correos con estado `scheduled` se procesan con GitHub Actions usando:

- workflow: `.github/workflows/process-scheduled-prospect-emails.yml`
- script: `scripts/process-scheduled-prospect-emails.mjs`

Configura estos secretos en GitHub:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`
- `RESEND_REPLY_TO_EMAIL` opcional

Luego puedes:

- esperar al cron de 15 minutos,
- o dispararlo manualmente desde GitHub Actions.

### 5. Adjuntos

En el formulario del correo, cada linea acepta:

```text
nombre-del-archivo.pdf | https://tu-dominio.com/ruta/archivo.pdf
```

Notas:

- solo se aceptan URLs `http` o `https`,
- el archivo debe ser accesible por Resend,
- se limitan a 10 adjuntos por correo.

### 6. Seguridad

- El navegador no ve la API key de Resend.
- La funcion valida que el usuario autenticado sea `admin`.
- El procesamiento programado usa la `service role key` solo dentro de GitHub Actions.

### 7. Si falla

- Verifica que la funcion `send-prospect-email` este desplegada.
- Verifica los secretos en Supabase.
- Verifica los secretos de GitHub Actions para correos programados.
- Verifica que tu dominio/remitente este autorizado en Resend.
- Revisa logs de la Edge Function y el mensaje devuelto al dashboard.
- Revisa el run de `Process scheduled prospect emails` si el fallo ocurre solo en correos programados.
