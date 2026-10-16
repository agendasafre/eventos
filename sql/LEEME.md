# Reutilizar la base para otra edición

Estas consultas se prepararon a partir de las tablas usadas por la aplicación. No se ejecutaron contra Supabase ni se verificaron contra su esquema real.

**Opción elegida para esta edición: `02_reiniciar_con_padron_nuevo.sql`.** Borra el padrón, las reservas de asientos y las asignaciones de pulseras a invitados; conserva las mesas y todas las pulseras, disponibles y sin marcas de sorteo. Luego se debe importar el nuevo padrón. El archivo 01 queda como alternativa y no se necesita ejecutar para este reinicio.

1. Exportar un respaldo de la base antes de aplicar el reinicio.
2. Detener temporalmente el registro, retiro y selección de mesas.
3. Ejecutar `00_inspeccionar.sql` en el SQL Editor de Supabase. Revisar columnas, valores predeterminados, restricciones, relaciones y triggers. Si hay otras tablas con datos de la edición anterior, hay que incorporarlas al plan de reinicio.
4. Elegir **una** alternativa:
   - `01_reiniciar_conservando_padron.sql`: conserva ID, DNI, nombre y condición manual de los invitados; limpia su inscripción. Conserva mesas y pulseras y libera todas las reservas.
   - `02_reiniciar_con_padron_nuevo.sql`: elimina los invitados y reservas; conserva mesas y pulseras. Requiere cargar un padrón nuevo.
5. Ejecutar el archivo completo. Termina en `ROLLBACK`: los resultados muestran cómo quedaría la base, pero los cambios se deshacen. Revisar antes los triggers: efectos externos como correos/webhooks podrían no deshacerse con un rollback.
6. Si la prueba es correcta, reemplazar la última sentencia `ROLLBACK` por `COMMIT` y ejecutar nuevamente el archivo completo. Las cantidades de actividad y reservas deben quedar en cero.

## Supuestos que deben verificarse

- `entradas.sorteado` existe y es booleano; la aplicación de sorteo lo requiere. Si falta, revisar el esquema antes de aplicar el reinicio.
- En la alternativa 01, `correo`, `lugar_trabajo` y `estado` vuelven al valor predeterminado definido en la base. Verificar que esos valores representen un invitado sin inscripción. Si una columna es NOT NULL sin un valor predeterminado, asignarle explícitamente el valor vacío permitido por su esquema. No se inventa un estado como `pendiente` porque podría violar un CHECK o enum.
- `mesa_token` admite un texto hexadecimal de 32 caracteres, como los tokens generados en `/api/manual`. Se regenera para invalidar enlaces antiguos y permitir nuevas selecciones. Revisar si un trigger lo modifica o si el tipo real exige otra expresión.
- Borrar `mesa_asientos` es compatible con la aplicación: los asientos libres se dibujan a partir de la capacidad de cada mesa, aunque no exista una fila por asiento.
- No se usa `CASCADE`. Si otra tabla referencia invitados o reservas, la transacción puede fallar y debe ajustarse después de revisar esa relación. Revisar también relaciones que ya tengan `ON DELETE CASCADE`.
- Los ID no se reinician: son identificadores internos, no contadores de ventas. Se conserva `entradas.numero`, la numeración necesaria para entregar pulseras. No se borran usuarios de Auth, archivos de Storage, funciones ni políticas RLS.

## Precio, cuotas y correos

El precio y las cuotas de las exportaciones se calculan en el proyecto; no se encontraron columnas de cobro usadas por los endpoints. No hace falta agregar una actualización de precio a estas consultas basándose únicamente en el código disponible.

La configuración está en `src/lib/precios.js`: $80.000 por entrada general y $70.000 para invitados manuales, ambos en 3 cuotas. Se conserva la distinción de cobro por planilla. Para una entrada general, las primeras dos cuotas son $26.666,67 y la última $26.666,66; para una manual, $23.333,33 y $23.333,34 respectivamente. Ambos CSV incluyen `importe_ultima_cuota` para que el redondeo no altere el total.

Los correos se generan en un Apps Script externo (`SCRIPT_URL`), cuyo código no está en este repositorio. Revisar allí los importes, cuotas, fechas y textos, tanto en correos iniciales como en reenvíos. Revisar también funciones/triggers de Supabase que tengan valores anteriores.

El formulario y `/api/register` cierran la inscripción el **30/11/2026 a las 23:59:59, hora de Argentina (UTC-3)**. La zona horaria está explícita para que el navegador y el servidor apliquen el mismo instante de cierre.
