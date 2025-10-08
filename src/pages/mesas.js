import { supabase } from '../lib/supabase.js';
import { ui } from '../ui.js';

const $ = (s, p = document) => p.querySelector(s);
const mesasContainer = $('#mesasContainer');
$('#anio').textContent = new Date().getFullYear();

const token = new URLSearchParams(window.location.search).get('token');
if (!token) {
  ui.error('No se encontró el token de acceso.');
  throw new Error('Token faltante');
}

ui.loading('Cargando mesas...');

let invitado = null;
let mesas = [];
let asientosSeleccionados = [];

async function cargarMesas() {
  try {
    // 1️⃣ Obtener invitado
    const { data: user, error: userErr } = await supabase
      .from('invitados')
      .select('*')
      .eq('mesa_token', token)
      .maybeSingle();
    if (userErr || !user) throw new Error('Token inválido');
    invitado = user;

    // 2️⃣ Obtener mesas y ocupaciones
    const { data: dataMesas, error: mesasErr } = await supabase
      .from('mesas')
      .select('id, numero, capacidad, mesa_asientos (id, posicion, invitado_id, invitados(nombre))')
      .order('numero', { ascending: true });

    if (mesasErr) throw mesasErr;

    mesas = dataMesas || [];
    ui.close();
    renderHeader();
    renderMesas();
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('Error al cargar las mesas.');
  }
}

function totalMenus() {
  return (
    (invitado.opciones_comun || 0) +
    (invitado.opciones_celiacos || 0) +
    (invitado.opciones_vegetarianos || 0) +
    (invitado.opciones_veganos || 0)
  );
}

function renderHeader() {
  const max = totalMenus();
  const seleccionados = asientosSeleccionados.length;
  const restantes = max - seleccionados;

  let html = `
    <div class="mb-6 text-center bg-white/90 p-4 rounded-xl shadow">
      <p class="text-azuloscuro font-semibold">
        Tenés <b>${max}</b> asiento${max > 1 ? 's' : ''} disponible${max > 1 ? 's' : ''}.
      </p>
      <p class="text-sm text-gray-600">
        Seleccionaste ${seleccionados}, te quedan ${restantes}.
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Podés cambiar cada asiento hasta <b>2 veces</b>.
      </p>
    </div>
  `;

  $('#estadoAsientos')?.remove();
  const div = document.createElement('div');
  div.id = 'estadoAsientos';
  div.innerHTML = html;
  mesasContainer.before(div);
}

function renderMesas() {
  mesasContainer.innerHTML = '';
  mesas.forEach((mesa) => {
    const div = document.createElement('div');
    div.className =
      'bg-white/90 rounded-2xl shadow-md p-5 flex flex-col items-center text-center transition-transform hover:scale-105 m-2';
    div.innerHTML = `
      <h2 class="text-azuloscuro font-bold mb-4">Mesa ${mesa.numero}</h2>
      <div class="grid grid-cols-4 gap-3">
        ${renderAsientos(mesa)}
      </div>
    `;
    mesasContainer.appendChild(div);
  });
}

function renderAsientos(mesa) {
  const asientos = mesa.mesa_asientos || [];
  const total = mesa.capacidad || 8;
  const posiciones = Array.from({ length: total }, (_, i) => i + 1);

  const completos = posiciones.map((pos) => {
    const real = asientos.find((a) => a.posicion === pos);
    return (
      real || {
        posicion: pos,
        invitado_id: null,
        invitados: null,
      }
    );
  });

  return completos
    .map((a) => {
      const ocupado = a.invitado_id && a.invitado_id !== invitado.id;
      const esTuAsiento = a.invitado_id === invitado.id;

      let color = ocupado
        ? 'bg-rojo text-white cursor-not-allowed'
        : esTuAsiento
          ? 'border-4 border-yellow-400'
          : 'border border-celeste hover:border-azuloscuro hover:bg-celeste/20';

      let icon = ocupado
        ? '<i class="fa-solid fa-user-slash"></i>'
        : esTuAsiento
          ? '<i class="fa-solid fa-star"></i>'
          : '<i class="fa-solid fa-chair"></i>';

      const nombre = ocupado
        ? a.invitados?.nombre || 'Ocupado'
        : esTuAsiento
          ? 'Tu asiento'
          : 'Disponible';

      // 🔥 Mostrar nombre completo si ocupado o propio
      const label =
        ocupado || esTuAsiento
          ? `<p class="text-sm text-gray-800 mt-1 text-center max-w-[120px] leading-tight">${esTuAsiento ? 'Vos' : a.invitados?.nombre || '—'}</p>`
          : '<p class="text-sm text-transparent mt-1 max-w-[120px] leading-tight">.</p>'; // mantiene altura uniforme

      return `
        <div class="flex flex-col items-center justify-center text-center">
          <button
            data-mesa="${mesa.id}"
            data-pos="${a.posicion}"
            class="asiento w-12 h-12 rounded-full flex items-center justify-center ${color} transition"
            title="${nombre}"
            ${ocupado ? 'disabled' : ''}
          >
            ${icon}
          </button>
          ${label}
        </div>
      `;
    })
    .join('');
}



mesasContainer.addEventListener('click', async (e) => {
  const btn = e.target.closest('.asiento');
  if (!btn || btn.disabled) return;

  const mesaId = parseInt(btn.dataset.mesa, 10);
  const pos = parseInt(btn.dataset.pos, 10);
  const max = totalMenus();

  // 1️⃣ Buscar si este asiento ya pertenece al invitado
  const { data: asientoExistente, error: qErr } = await supabase
    .from('mesa_asientos')
    .select('*')
    .eq('mesa_id', mesaId)
    .eq('posicion', pos)
    .maybeSingle();

  if (qErr) {
    console.error(qErr);
    ui.error('No se pudo verificar el estado del asiento.');
    return;
  }

  // 2️⃣ Si es tu asiento, intentar liberarlo
  if (asientoExistente?.invitado_id === invitado.id) {
    const cambios = asientoExistente.cambios || 0;

    if (cambios >= 2) {
      ui.info('Ya no podés cambiar este asiento más de 2 veces.');
      return;
    }

    ui.loading('Liberando asiento...');
    try {
      const { error } = await supabase
        .from('mesa_asientos')
        .update({ invitado_id: null, cambios: cambios + 1 })
        .eq('id', asientoExistente.id);

      if (error) throw error;
      ui.close();
      ui.success('Asiento liberado correctamente.');
      await cargarMesas();
    } catch (err) {
      ui.close();
      console.error(err);
      ui.error('Error al liberar el asiento.');
    }
    return;
  }

  // 3️⃣ Si está ocupado por otro, no permitir selección
  if (asientoExistente?.invitado_id && asientoExistente.invitado_id !== invitado.id) {
    ui.info('Ese asiento ya está ocupado.');
    return;
  }

  // 4️⃣ Controlar límite total de asientos
  if (asientosSeleccionados.length >= max) {
    ui.info('Ya seleccionaste todos tus asientos disponibles.');
    return;
  }

  // 5️⃣ Asiento libre → asignar
  ui.loading('Guardando tu selección...');
  try {
    let query;
    if (asientoExistente) {
      // actualizar asiento vacío existente
      query = supabase
        .from('mesa_asientos')
        .update({ invitado_id: invitado.id })
        .eq('id', asientoExistente.id);
    } else {
      // crear nuevo registro (si no existía)
      query = supabase
        .from('mesa_asientos')
        .insert([{ mesa_id: mesaId, posicion: pos, invitado_id: invitado.id }]);
    }

    const { error } = await query;
    if (error) throw error;

    asientosSeleccionados.push({ mesa_id: mesaId, posicion: pos });
    ui.close();
    ui.success('Asiento seleccionado correctamente.');
    await cargarMesas();
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('No se pudo guardar tu selección.');
  }
});

cargarMesas();
