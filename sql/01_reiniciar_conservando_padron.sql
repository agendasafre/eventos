-- Conserva invitados (incluidos manuales), sus ID, DNI y nombres,
-- el catálogo de mesas y la numeración de entradas/pulseras.
-- Borra reservas, inscripciones, retiros y resultados del sorteo.
-- Antes: exportar un respaldo y revisar 00_inspeccionar.sql y LEEME.md.
-- Modo de prueba: ROLLBACK al final deshace los cambios de la base.
begin;

lock table public.invitados, public.entradas, public.mesas,
           public.mesa_asientos in access exclusive mode;

delete from public.mesa_asientos;

update public.entradas
set entregado = false,
    dni_titular = null,
    sorteado = false;

update public.invitados
set correo = default,
    lugar_trabajo = default,
    acepto_terminos = false,
    retiro = false,
    estado = default,
    opciones = 0,
    opciones_comun = 0,
    opciones_celiacos = 0,
    opciones_vegetarianos = 0,
    opciones_veganos = 0,
    -- Nuevos tokens: los enlaces de la edición anterior dejan de servir.
    mesa_token = md5(gen_random_uuid()::text);

select count(*) as invitados_conservados,
       count(*) filter (where acepto_terminos or retiro or opciones <> 0)
         as invitados_con_actividad
from public.invitados;
select count(*) as pulseras_conservadas,
       count(*) filter (where entregado or dni_titular is not null or sorteado)
         as pulseras_con_actividad
from public.entradas;
select count(*) as reservas_restantes from public.mesa_asientos;

rollback;
-- Para aplicar definitivamente, REEMPLAZAR el ROLLBACK anterior por COMMIT.
