# Cena UNSJ – Eventos

Aplicación para registro, retiro y asignación de mesas para la cena de fin de año.

## Requisitos
- Node.js 18+
- Vite
- Cuenta de Supabase (URL y claves)

## Variables de entorno

Frontend (Vite):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_INTERNAL_KEY (clave para páginas internas como retiro y manual)

Backend (Vercel):
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- SCRIPT_URL (opcional para envíos de correo)
- INTERNAL_KEY (opcional, debe coincidir con VITE_INTERNAL_KEY para /api/manual)

## Scripts básicos
- pnpm dev → servidor de desarrollo
- pnpm build → compilar
- pnpm preview → vista previa estática

## Invitados manuales (personal contratado, excepciones)

Para diferenciar y permitir la carga manual de personas que no pueden validar DNI, agregamos una columna en la tabla `invitados` y una vista interna.

1) En Supabase, ejecutar:

```sql
alter table public.invitados
add column if not exists es_manual boolean not null default false;
```

2) Variables de entorno (servidor y cliente):

- Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SCRIPT_URL` (opcional para mails), `INTERNAL_KEY` (clave para /api/manual)
- Frontend: `VITE_INTERNAL_KEY` (debe coincidir con `INTERNAL_KEY`)

3) Página interna de carga: `manual.html`

- Protegida por clave (simple) con `VITE_INTERNAL_KEY`.
- Permite crear o actualizar invitados manuales marcando `es_manual = true` y generando `mesa_token` automáticamente.
- Muestra el link directo para selección de mesas `mesas.html?token=...`.

4) Endpoint:

- `POST /api/manual` con body: `{ dni?, nombre, correo, lugar?, comun, celiacos, vegetarianos, veganos }`.
- Requiere header `X-Internal-Key` si `INTERNAL_KEY` está definido en el entorno del servidor.

## Notas
- El retiro con `/api/retirar` valida por DNI; si se crea un invitado manual sin DNI, el proceso de retiro por DNI no aplicará.
- La selección de mesas usa `mesa_token`, por lo que funciona incluso si el DNI es nulo.

