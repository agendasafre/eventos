-- Alternativa a 01: elimina TODOS los invitados, incluidos manuales.
-- Conserva mesas y numeración de entradas/pulseras disponibles para reutilizar.
-- Después hay que importar el padrón nuevo antes de abrir inscripciones.
-- Antes: exportar un respaldo y revisar 00_inspeccionar.sql y LEEME.md.
begin;

lock table public.invitados, public.entradas, public.mesas,
           public.mesa_asientos in access exclusive mode;

delete from public.mesa_asientos;
update public.entradas
set entregado = false,
    dni_titular = null,
    sorteado = false;
delete from public.invitados;

select count(*) as invitados_restantes from public.invitados;
select count(*) as reservas_restantes from public.mesa_asientos;
select count(*) as pulseras_conservadas,
       count(*) filter (where entregado or dni_titular is not null or sorteado)
         as pulseras_con_actividad
from public.entradas;

rollback;
-- Para aplicar definitivamente, REEMPLAZAR el ROLLBACK anterior por COMMIT.
