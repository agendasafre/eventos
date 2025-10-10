import { supabase } from '../lib/supabase.js';
import { ui } from '../ui.js';
import { post } from '../lib/api.js';

const $ = (s, p = document) => p.querySelector(s);
const mesasContainer = $('#mesasContainer');
const confirmBtn = $('#confirmBtn');
$('#anio').textContent = new Date().getFullYear();

const CONFIRM_ENDPOINT = import.meta.env.DEV
  ? 'https://cena-unsj.vercel.app/api/confirmar'
  : '/api/confirmar';

// Token del invitado
const token = new URLSearchParams(window.location.search).get('token');
if (!token) {
  ui.error('No se encontró el token de acceso.');
  throw new Error('Token faltante');
}

let state = {
  invitado: null,
  mesas: [],
  confirmed: [],
  draft: [],
  pendingMove: null,
  draftCounter: 0,
  realtimeChannel: null,
  realtimeSyncing: false,
  realtimeQueued: false,
  lastRealtimeNoticeAt: 0,
};

// ---- Helpers ----
const seatKey = (mesaId, posicion) => `${mesaId}:${posicion}`;

function totalMenus() {
  const inv = state.invitado || {};
  return (
    (inv.opciones_comun || 0) +
    (inv.opciones_celiacos || 0) +
    (inv.opciones_vegetarianos || 0) +
    (inv.opciones_veganos || 0)
  );
}

function cloneConfirmedToDraft() {
  state.draft = state.confirmed.map((seat) => ({
    ...seat,
    clientId: `seat-${seat.id}`,
    originalMesaId: seat.mesa_id,
    originalPosicion: seat.posicion,
    isNew: false,
    isMoved: false,
    proposedCambios: seat.cambios,
  }));
  state.pendingMove = null;
  updateConfirmButton();
}

function draftSeatsMap() {
  const map = new Map();
  state.draft.forEach((seat) => {
    if (seat.mesa_id && seat.posicion) {
      map.set(seatKey(seat.mesa_id, seat.posicion), seat);
    }
  });
  return map;
}

function draftHasChanges() {
  if (state.draft.length !== state.confirmed.length) return true;

  const confirmedById = new Map();
  state.confirmed.forEach((seat) => confirmedById.set(seat.id, seat));

  for (const seat of state.draft) {
    if (!seat.id) return true; // asiento nuevo
    const original = confirmedById.get(seat.id);
    if (!original) return true; // se liberó un asiento
    if (seat.mesa_id !== original.mesa_id || seat.posicion !== original.posicion) {
      return true;
    }
    if ((seat.proposedCambios || seat.cambios) !== original.cambios) {
      return true;
    }
  }
  return false;
}

function draftHasPendingSeatCount() {
  return state.draft.length !== totalMenus();
}

function updateConfirmButton() {
  const hasChanges = draftHasChanges();
  const needsSeats = draftHasPendingSeatCount();

  if (!hasChanges || needsSeats) {
    confirmBtn.classList.add('hidden');
    confirmBtn.disabled = true;
    return;
  }

  confirmBtn.classList.remove('hidden');
  confirmBtn.disabled = false;
}

function renderHeader() {
  const max = totalMenus();
  const seleccionados = state.draft.length;
  const restantes = Math.max(max - seleccionados, 0);
  const cambiosPendientes = draftHasChanges();
  const pendientesTexto = cambiosPendientes
    ? '<span class="text-orange-500 font-semibold">Tenés cambios sin confirmar.</span>'
    : '<span class="text-green-600 font-semibold">Todo guardado.</span>';

  const html = `
    <div class="mb-6 text-center bg-white/90 p-4 rounded-xl shadow">
      <p class="text-azuloscuro font-semibold">
        Tenés <b>${max}</b> asiento${max !== 1 ? 's' : ''} disponible${max !== 1 ? 's' : ''}.
      </p>
      <p class="text-sm text-gray-600">
        Seleccionaste ${seleccionados}, te quedan ${restantes}.
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Podés cambiar cada asiento hasta <b>2 veces</b>.
      </p>
      <p class="text-xs mt-2">${pendientesTexto}</p>
    </div>
  `;

  $('#estadoAsientos')?.remove();
  const div = document.createElement('div');
  div.id = 'estadoAsientos';
  div.innerHTML = html;
  mesasContainer.before(div);
}

function buildOccupancyMap(dataMesas) {
  const map = new Map();
  (dataMesas || []).forEach((mesa) => {
    (mesa.mesa_asientos || []).forEach((asiento) => {
      if (!asiento) return;
      map.set(seatKey(mesa.id, asiento.posicion), {
        mesa_id: mesa.id,
        ...asiento,
      });
    });
  });
  return map;
}

function cargarDesdeMesas(dataMesas, invitadoId, { preserveDraft = false } = {}) {
  const mesas = dataMesas || [];
  const confirmed = [];
  const occupancy = buildOccupancyMap(mesas);

  mesas.forEach((mesa) => {
    (mesa.mesa_asientos || []).forEach((asiento) => {
      if (asiento?.invitado_id === invitadoId) {
        confirmed.push({
          id: asiento.id,
          mesa_id: mesa.id,
          posicion: asiento.posicion,
          cambios: asiento.cambios || 0,
        });
      }
    });
  });

  state.mesas = mesas;
  state.confirmed = confirmed;

  if (!preserveDraft) {
    cloneConfirmedToDraft();
    return { removedKeys: [], occupancy };
  }

  const updatedDraft = [];
  const removedKeys = [];
  const pendingKey = state.pendingMove
    ? seatKey(state.pendingMove.fromMesaId, state.pendingMove.fromPosicion)
    : null;

  state.draft.forEach((seat) => {
    const key = seatKey(seat.mesa_id, seat.posicion);
    const occupant = occupancy.get(key);

    if (occupant && occupant.invitado_id && occupant.invitado_id !== invitadoId) {
      removedKeys.push(key);
      return;
    }

    if (occupant && occupant.invitado_id === invitadoId) {
      seat.id = occupant.id;
      seat.cambios = occupant.cambios || 0;
      seat.proposedCambios = seat.proposedCambios ?? seat.cambios;
      seat.isNew = false;
      seat.isMoved = false;
    }

    updatedDraft.push(seat);
  });

  state.draft = updatedDraft;

  if (pendingKey) {
    const occupant = occupancy.get(pendingKey);
    if (!occupant || occupant.invitado_id !== invitadoId) {
      state.pendingMove = null;
    }
  }

  return { removedKeys, occupancy };
}

// ---- Cargar mesas e invitado ----
async function cargarMesas({
  showLoading = false,
  preserveDraft = false,
  loadingMessage = 'Actualizando mesas...',
} = {}) {
  try {
    if (showLoading) ui.loading(loadingMessage);

    if (!state.invitado || !preserveDraft) {
      const { data: user, error: userErr } = await supabase
        .from('invitados')
        .select('*')
        .eq('mesa_token', token)
        .maybeSingle();

      if (userErr || !user) throw new Error('Token inválido');
      state.invitado = user;
    }

    const { data: dataMesas, error: mesasErr } = await supabase
      .from('mesas')
      .select(`
        id,
        numero,
        capacidad,
        mesa_asientos (
          id,
          posicion,
          invitado_id,
          cambios,
          invitados ( nombre )
        )
      `)
      .order('numero', { ascending: true });

    if (mesasErr) throw mesasErr;

    const { removedKeys } = cargarDesdeMesas(dataMesas, state.invitado.id, { preserveDraft });
    render();

    if (preserveDraft && removedKeys.length) {
      const now = Date.now();
      if (now - state.lastRealtimeNoticeAt > 3000) {
        const mensaje =
          removedKeys.length === 1
            ? 'Un asiento que estabas mirando fue tomado por otra persona. Actualizamos tu selección.'
            : 'Algunos asientos que estabas mirando fueron tomados por otras personas. Actualizamos tu selección.';
        ui.info(mensaje);
        state.lastRealtimeNoticeAt = now;
      }
    }
  } catch (err) {
    console.error(err);
    if (!preserveDraft) {
      ui.error('Error al cargar las mesas.');
    }
  } finally {
    if (showLoading) ui.close();
  }
}

function renderMesas() {
  mesasContainer.innerHTML = '';
  const draftMap = draftSeatsMap();
  const pendingFromKey = state.pendingMove
    ? seatKey(state.pendingMove.fromMesaId, state.pendingMove.fromPosicion)
    : null;

  state.mesas.forEach((mesa) => {
    const wrapper = document.createElement('div');
    wrapper.className =
      'bg-white/90 rounded-2xl shadow-md p-5 flex flex-col items-center text-center transition-transform hover:scale-105 m-2';

    const header = document.createElement('h2');
    header.className = 'text-azuloscuro font-bold mb-4';
    header.textContent = `Mesa ${mesa.numero}`;
    wrapper.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-4 gap-3';

    const total = mesa.capacidad || 8;
    for (let pos = 1; pos <= total; pos += 1) {
      const real = (mesa.mesa_asientos || []).find((a) => a.posicion === pos) || null;
      const key = seatKey(mesa.id, pos);
      const draftSeat = draftMap.get(key);

  const ocupadoPorOtro = real?.invitado_id && real.invitado_id !== state.invitado.id;
  const esTuActual = !!real && real.invitado_id === state.invitado.id;
  const estaReservadoPorVos = !!draftSeat;
      const esAsientoNuevo = draftSeat?.isNew || draftSeat?.isMoved;
      const esPendienteDesde = pendingFromKey === key;

      const button = document.createElement('button');
      button.dataset.mesa = mesa.id;
      button.dataset.pos = pos;
      button.className =
        'asiento w-12 h-12 rounded-full flex items-center justify-center transition border';

      const icon = document.createElement('i');
      icon.classList.add('fa-solid');

      let title = 'Disponible';
      let labelText = 'Disponible';
      let labelClass = 'text-transparent';

      if (ocupadoPorOtro) {
        button.classList.add('bg-rojo', 'text-white', 'cursor-not-allowed');
        button.disabled = true;
        icon.classList.add('fa-user-slash');
        title = real?.invitados?.nombre || 'Ocupado';
        labelText = real?.invitados?.nombre || 'Ocupado';
        labelClass = 'text-gray-800';
      } else if (esPendienteDesde && esTuActual) {
        button.classList.add(
          'border-2',
          'border-dashed',
          'border-azuloscuro',
          'bg-azuloscuro/10',
          'text-azuloscuro'
        );
        icon.classList.add('fa-person-walking-arrow-right');
        title = 'Liberado para mover';
        labelText = 'Elegí tu nuevo asiento';
        labelClass = 'text-azuloscuro font-semibold';
      } else if (estaReservadoPorVos) {
        button.classList.add('border-4', 'border-emerald-400', 'bg-emerald-50');
        icon.classList.add('fa-star', 'text-emerald-500');
        title = esAsientoNuevo ? 'Nuevo asiento seleccionado' : 'Tu asiento';
        labelText = esAsientoNuevo ? 'Nuevo' : 'Confirmado';
        labelClass = 'text-emerald-600';
      } else if (esTuActual) {
        button.classList.add('border-4', 'border-yellow-400', 'bg-yellow-50');
        icon.classList.add('fa-star', 'text-yellow-400');
        title = 'Tu asiento actual';
        labelText = 'Actual';
        labelClass = 'text-yellow-500';
      } else {
        button.classList.add(
          'border',
          'border-celeste',
          'hover:border-azuloscuro',
          'hover:bg-celeste/20'
        );
        icon.classList.add('fa-chair', 'text-amber-800');
      }

      button.title = title;
      button.appendChild(icon);

      const container = document.createElement('div');
      container.className = 'flex flex-col items-center justify-center text-center';
      container.appendChild(button);

      const label = document.createElement('p');
      label.className = `text-sm mt-1 max-w-[120px] leading-tight ${labelClass}`;
      label.textContent = labelText === 'Disponible' ? '.' : labelText;
      container.appendChild(label);

      grid.appendChild(container);
    }

    wrapper.appendChild(grid);
    mesasContainer.appendChild(wrapper);
  });
}

function render() {
  renderHeader();
  renderMesas();
  updateConfirmButton();
}

function findDraftSeatByKey(mesaId, posicion) {
  return state.draft.find((seat) => seat.mesa_id === mesaId && seat.posicion === posicion);
}

function findDraftSeatByClientId(clientId) {
  return state.draft.find((seat) => seat.clientId === clientId);
}

function beginMoveSeat(seat, mesaId, posicion) {
  if (state.pendingMove) {
    ui.info('Primero ubicá el asiento que ya estás moviendo.');
    return;
  }
  if (seat.cambios >= 2) {
    ui.info('No podés cambiar este asiento más de 2 veces.');
    return;
  }

  state.pendingMove = {
    clientId: seat.clientId,
    fromMesaId: mesaId,
    fromPosicion: posicion,
  };
  render();
  ui.info('Elegí el nuevo lugar para este asiento.');
}

function cancelPendingMove() {
  state.pendingMove = null;
  render();
}

function removeDraftSeat(seat) {
  state.draft = state.draft.filter((item) => item.clientId !== seat.clientId);
  render();
}

function assignPendingMove(targetMesaId, targetPos) {
  const move = state.pendingMove;
  if (!move) return;

  const seat = findDraftSeatByClientId(move.clientId);
  if (!seat) {
    cancelPendingMove();
    return;
  }

  const nextCambios = (seat.cambios || 0) + 1;
  if (nextCambios > 2) {
    ui.info('No podés cambiar este asiento más de 2 veces.');
    cancelPendingMove();
    return;
  }

  const alreadyTaken = findDraftSeatByKey(targetMesaId, targetPos);
  if (alreadyTaken) {
    ui.info('Ya seleccionaste ese lugar. Elegí otro.');
    return;
  }

  seat.mesa_id = targetMesaId;
  seat.posicion = targetPos;
  seat.isMoved = true;
  seat.cambios = nextCambios;
  seat.proposedCambios = nextCambios;

  state.pendingMove = null;
  render();
}

function addNewDraftSeat(mesaId, posicion) {
  const max = totalMenus();
  if (state.draft.length >= max) {
    ui.info('Ya seleccionaste todos tus asientos disponibles.');
    return;
  }

  state.draftCounter += 1;
  state.draft.push({
    id: null,
    mesa_id: mesaId,
    posicion,
    cambios: 0,
    proposedCambios: 0,
    isNew: true,
    isMoved: false,
    originalMesaId: null,
    originalPosicion: null,
    clientId: `new-${state.draftCounter}`,
  });

  render();
}

function handleSeatClick(mesaId, posicion) {
  const mesa = state.mesas.find((m) => m.id === mesaId);
  if (!mesa) return;

  const real = (mesa.mesa_asientos || []).find((a) => a.posicion === posicion) || null;
  const draftSeat = findDraftSeatByKey(mesaId, posicion);
  const pending = state.pendingMove;

  const ocupadoPorOtro = real?.invitado_id && real.invitado_id !== state.invitado.id;
  if (ocupadoPorOtro) {
    ui.info('Ese asiento ya está ocupado.');
    return;
  }

  // Click sobre asiento nuevo en draft -> quitar
  if (draftSeat && draftSeat.isNew) {
    removeDraftSeat(draftSeat);
    return;
  }

  // Click sobre asiento en movimiento -> cancelar
  if (pending && pending.fromMesaId === mesaId && pending.fromPosicion === posicion) {
    cancelPendingMove();
    return;
  }

  // Click sobre asiento propio (confirmado o movido)
  if (draftSeat && !draftSeat.isNew) {
    beginMoveSeat(draftSeat, mesaId, posicion);
    return;
  }

  // Si hay pendiente, intentar asignar
  if (pending) {
    assignPendingMove(mesaId, posicion);
    return;
  }

  // Evitar doble selección sobre asiento libre si ya lo tomó otro en la vista
  if (draftSeat) {
    ui.info('Ese asiento ya lo tenés reservado.');
    return;
  }

  // Asiento disponible
  addNewDraftSeat(mesaId, posicion);
}

mesasContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.asiento');
  if (!btn) return;
  const mesaId = parseInt(btn.dataset.mesa, 10);
  const posicion = parseInt(btn.dataset.pos, 10);
  if (Number.isNaN(mesaId) || Number.isNaN(posicion)) return;
  handleSeatClick(mesaId, posicion);
});

confirmBtn.addEventListener('click', async () => {
  if (confirmBtn.disabled) return;
  const pending = draftHasChanges();
  if (!pending) {
    ui.info('No hay cambios para confirmar.');
    return;
  }

  const max = totalMenus();
  if (state.draft.length !== max) {
    ui.info(`Debés seleccionar ${max} asiento${max !== 1 ? 's' : ''} antes de confirmar.`);
    return;
  }

  try {
    ui.loading('Confirmando selección...');

    const payload = {
      token,
      asientos: state.draft.map((seat) => ({
        id: seat.id,
        mesa_id: seat.mesa_id,
        posicion: seat.posicion,
        original_mesa_id: seat.originalMesaId,
        original_posicion: seat.originalPosicion,
        cambios: seat.proposedCambios ?? seat.cambios,
      })),
    };

    const response = await post(CONFIRM_ENDPOINT, payload);
    const data = JSON.parse(response || '{}');

    ui.close();
    ui.success(data?.message || '¡Listo! Guardamos tu selección.');
    await cargarMesas({ showLoading: true });
  } catch (err) {
    console.error(err);
    ui.close();
    try {
      const parsed = JSON.parse(err.message);
      ui.error(parsed?.error || 'No pudimos guardar tus asientos.');
    } catch (_) {
      ui.error(err.message || 'No pudimos guardar tus asientos.');
    }
    await cargarMesas({ preserveDraft: true });
  }
});

async function renderRealtimeUpdate() {
  if (state.realtimeSyncing) {
    state.realtimeQueued = true;
    return;
  }

  state.realtimeSyncing = true;
  try {
    await cargarMesas({ preserveDraft: true });
  } finally {
    state.realtimeSyncing = false;
    if (state.realtimeQueued) {
      state.realtimeQueued = false;
      renderRealtimeUpdate();
    }
  }
}

function subscribeRealtime() {
  if (state.realtimeChannel) return;

  const channel = supabase
    .channel('mesa-asientos-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mesa_asientos',
      },
      () => {
        renderRealtimeUpdate();
      }
    )
    .subscribe();

  state.realtimeChannel = channel;
}

window.addEventListener('beforeunload', () => {
  state.realtimeChannel?.unsubscribe();
});

async function init() {
  await cargarMesas({ showLoading: true, loadingMessage: 'Cargando mesas...' });
  subscribeRealtime();
}

init();