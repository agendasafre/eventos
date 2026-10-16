-- Ejecutar primero en el SQL Editor de Supabase y revisar los resultados.
-- Solo lectura: el repositorio no contiene el esquema de producción.
select table_name, column_name, data_type, is_nullable, column_default,
       is_identity, is_generated
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select conrelid::regclass as tabla, conname,
       pg_get_constraintdef(oid) as definicion
from pg_constraint
where connamespace = 'public'::regnamespace
order by tabla, conname;

select event_object_table as tabla, trigger_name, action_timing,
       event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by tabla, trigger_name;

-- Revisar especialmente funciones que generan mesa_token o envían notificaciones.
select p.proname, pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f';

select 'invitados' as tabla, count(*) as filas from public.invitados
union all select 'entradas', count(*) from public.entradas
union all select 'mesas', count(*) from public.mesas
union all select 'mesa_asientos', count(*) from public.mesa_asientos;

select estado, es_manual, count(*) as cantidad
from public.invitados
group by estado, es_manual
order by estado, es_manual;
