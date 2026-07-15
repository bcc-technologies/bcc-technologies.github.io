# Acceso de desarrolladores MAPs

La fuente de identidad y autorización es el workspace de BCC. MAPs debe consumirla como autoridad y no mantener una lista local de correos autorizados.

## Permisos

| Permiso | Alcance |
| --- | --- |
| `maps:developer:access` | Entrar a la interfaz de desarrolladores. |
| `maps:developer:read` | Consultar diagnóstico, telemetría y configuración de solo lectura. |
| `maps:developer:write` | Cambiar configuraciones y ejecutar acciones de desarrollo no publicables. |
| `maps:developer:release` | Aprobar o publicar versiones. Debe requerir una segunda comprobación en el backend de MAPs. |

El staff normal, autores, directores y cofundadores no reciben permisos MAPs automáticamente. Solo `admin`, `maps_developer` y `maps_release_manager` los reciben por su rol efectivo. Un administrador puede conceder roles internos acumulables desde el dashboard.

## Integración con el repositorio MAPs

1. MAPs inicia sesión contra el mismo proveedor de identidad (actualmente Supabase) o valida un token emitido por ese proveedor.
2. El backend de MAPs recupera el perfil por el `sub`/UUID autenticado y calcula permisos desde `role`, `staff_roles` y `custom_roles`; no confía en permisos enviados por el navegador.
3. Cada endpoint comprueba el permiso mínimo. Por ejemplo, `release` exige `maps:developer:release`, no solo `maps:developer:access`.
4. MAPs registra en su propia auditoría el usuario, permiso comprobado, acción y resultado.

La página `maps-developer.html` es una puerta de interfaz del workspace. No protege por sí sola APIs ni secretos: esa protección tiene que vivir en el backend del repositorio MAPs.

Para mostrar el enlace al proyecto, define `window.BCC_MAPS_DEVELOPER_URL` en la configuración privada que carga el workspace. No pongas tokens, claves de servicio ni URLs administrativas sensibles en JavaScript público.
