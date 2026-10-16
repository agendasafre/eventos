# Correos de la cena

`Code.gs` contiene el Apps Script completo actualizado a partir del archivo compartido. Mantiene los precios de $80.000 para invitados generales y $70.000 para manuales, ambos en **4 cuotas**, según la última indicación.

El registro manual recibe `mesa_token` desde `/api/manual` o `/api/reenviar` e incluye el botón «Gestionar asiento/s». El enlace usa `APP_URL` y la ruta `/mesas?token=…`. El registro normal conserva su correo sin ese botón. Si no se recibe token, el botón se omite.

## Publicar

1. Abrir el proyecto correspondiente en Google Apps Script y reemplazar el contenido de su archivo de código por `Code.gs`. Evitar dejar copias de las mismas funciones y constantes en otros archivos del proyecto.
2. Guardar y abrir **Implementar → Administrar implementaciones**.
3. Editar la implementación web existente y seleccionar **Nueva versión**; implementar conservando la URL existente que está configurada como `SCRIPT_URL` en Vercel.
4. Desplegar en Vercel los cambios de `/api/manual` y `/api/reenviar`.
5. Con un correo de prueba propio, verificar el alta manual y el reenvío de registro: ambos deben incluir el botón con el token almacenado en Supabase. Esta verificación real queda a cargo del usuario; las comprobaciones locales simulan el envío.

No se necesitan cambios de esquema en Supabase. Los registros anteriores pueden recibir el enlace mediante el reenvío, siempre que tengan `mesa_token`.

## Verificación local

Ejecutar `node apps-script/verificar.cjs` desde la raíz del proyecto. Comprueba alta y actualización manual, reenvío manual y normal, enlaces codificados, ausencia de botón sin token, precios y cuatro cuotas, y los enlaces de retiro y resumen de mesas. Usa implementaciones simuladas de Supabase, fetch y GmailApp; no envía correos ni modifica la base.
