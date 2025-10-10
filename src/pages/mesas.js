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
    if (seat.mesa_id !== seat.originalMesaId || seat.posicion !== seat.originalPosicion) {
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
  const movingSeat = Boolean(state.pendingMove);
  const seleccionados = Math.max(state.draft.length - (movingSeat ? 1 : 0), 0);
  const restantes = Math.max(max - seleccionados, 0);
  const cambiosPendientes = draftHasChanges();
  const pendientesTexto = cambiosPendientes
    ? '<span class="text-orange-500 font-semibold">Tenés cambios sin confirmar.</span>'
    : '<span class="text-green-600 font-semibold">Todo guardado.</span>';

  const instrucciones = `
    <div class="mt-3 text-sm text-gray-600">
      <p>Para cambiar un asiento, tocá uno de los tuyos y después elegí el nuevo lugar.</p>
      <p class="mt-1 text-xs text-gray-500">Mientras estás moviendo un asiento, ese lugar queda momentáneamente libre hasta que elijas otro.</p>
    </div>
  `;

  const movimientoActivo = movingSeat
    ? '<p class="text-sm text-azuloscuro mt-3 font-semibold">Estás moviendo un asiento: elegí el nuevo lugar para finalizar.</p>'
    : '';

  const html = `
    <div class="mb-6 text-center bg-white/90 p-4 rounded-xl shadow">
      <p class="text-azuloscuro font-semibold">
        Tenés <b>${max}</b> asiento${max !== 1 ? 's' : ''} disponible${max !== 1 ? 's' : ''}.
      </p>
      <p class="text-sm text-gray-600">
        Seleccionaste ${seleccionados}, te quedan ${restantes}.
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Podés confirmar los cambios de cada asiento hasta <b>2 veces</b>.
      </p>
      <p class="text-xs mt-2">${pendientesTexto}</p>
      ${movimientoActivo}
      ${instrucciones}
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
      seat.isNew = false;
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

  state.draft.forEach((seat) => {
    seat.isMoved = seat.mesa_id !== seat.originalMesaId || seat.posicion !== seat.originalPosicion;
  });

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

function refreshHeaderOnly() {
  renderHeader();
  updateConfirmButton();
}

function updateSeatDom(mesaId, posicion) {
  const mesa = state.mesas.find((m) => m.id === mesaId);
  if (!mesa) return false;

  const button = mesasContainer.querySelector(
    `.asiento[data-mesa="${mesaId}"][data-pos="${posicion}"]`
  );
  if (!button) return false;

  const icon = button.querySelector('i');
  const label = button.parentElement?.querySelector('p');

  const real = (mesa.mesa_asientos || []).find((a) => a.posicion === posicion) || null;
  const draftSeat = findDraftSeatByKey(mesaId, posicion);
  const invitadoId = state.invitado?.id;
  const pendingFromKey = state.pendingMove
    ? seatKey(state.pendingMove.fromMesaId, state.pendingMove.fromPosicion)
    : null;
  const key = seatKey(mesaId, posicion);

  const ocupadoPorOtro = real?.invitado_id && real.invitado_id !== invitadoId;
  const esTuActual = !!real && real.invitado_id === invitadoId;
  const estaReservadoPorVos = !!draftSeat;
  const esAsientoNuevo = draftSeat?.isNew || draftSeat?.isMoved;
  const esPendienteDesde = pendingFromKey === key;

  let buttonClasses =
    'asiento w-12 h-12 rounded-full flex items-center justify-center transition border';
  let buttonExtras = '';
  const iconClasses = ['fa-solid'];
  let labelText = 'Disponible';
  let labelClass = 'text-transparent';
  let title = 'Disponible';
  let disabled = false;

  if (ocupadoPorOtro) {
    buttonExtras = 'bg-rojo text-white cursor-not-allowed';
    iconClasses.push('fa-user-slash');
    title = real?.invitados?.nombre || 'Ocupado';
    labelText = real?.invitados?.nombre || 'Ocupado';
    labelClass = 'text-gray-800';
    disabled = true;
  } else if (esPendienteDesde && esTuActual) {
    buttonExtras = 'border-2 border-dashed border-azuloscuro bg-azuloscuro/10 text-azuloscuro';
    iconClasses.push('fa-person-walking-arrow-right');
    title = 'Liberado para mover';
    labelText = 'Elegí tu nuevo asiento';
    labelClass = 'text-azuloscuro font-semibold';
  } else if (estaReservadoPorVos) {
    buttonExtras = 'border-4 border-emerald-400 bg-emerald-50';
    iconClasses.push('fa-star', 'text-emerald-500');
    title = esAsientoNuevo ? 'Nuevo asiento seleccionado' : 'Tu asiento';
    labelText = esAsientoNuevo ? 'Nuevo' : 'Confirmado';
    labelClass = 'text-emerald-600';
  } else if (esTuActual) {
    buttonExtras = 'border-4 border-yellow-400 bg-yellow-50';
    iconClasses.push('fa-star', 'text-yellow-400');
    title = 'Tu asiento actual';
    labelText = 'Actual';
    labelClass = 'text-yellow-500';
  } else {
    buttonExtras = 'border-celeste hover:border-azuloscuro hover:bg-celeste/20';
    iconClasses.push('fa-chair', 'text-amber-800');
  }

  button.className = `${buttonClasses} ${buttonExtras}`.trim();
  button.disabled = disabled;
  button.title = title;

  if (icon) {
    icon.className = iconClasses.join(' ');
  }

  if (label) {
    label.className = `text-sm mt-1 max-w-[120px] leading-tight ${labelClass}`.trim();
    label.textContent = labelText === 'Disponible' ? '.' : labelText;
  }

  return true;
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

  const originalMesaId = seat.originalMesaId ?? mesaId;
  const originalPosicion = seat.originalPosicion ?? posicion;

  const previousMesaId = seat.mesa_id;
  const previousPosicion = seat.posicion;

  const alreadyMoved =
    seat.id && (seat.mesa_id !== originalMesaId || seat.posicion !== originalPosicion);

  if (alreadyMoved) {
    seat.mesa_id = originalMesaId;
    seat.posicion = originalPosicion;
    seat.isMoved = false;
    updateSeatDom(previousMesaId, previousPosicion) || render();
  }

  state.pendingMove = {
    clientId: seat.clientId,
    fromMesaId: seat.mesa_id,
    fromPosicion: seat.posicion,
  };
  updateSeatDom(originalMesaId, originalPosicion) || render();
  refreshHeaderOnly();
}

function cancelPendingMove() {
  const pending = state.pendingMove;
  state.pendingMove = null;
  if (pending) {
    updateSeatDom(pending.fromMesaId, pending.fromPosicion) || render();
  }
  refreshHeaderOnly();
}

function removeDraftSeat(seat) {
  state.draft = state.draft.filter((item) => item.clientId !== seat.clientId);
  updateSeatDom(seat.mesa_id, seat.posicion) || render();
  refreshHeaderOnly();
}

function assignPendingMove(targetMesaId, targetPos) {
  const move = state.pendingMove;
  if (!move) return;

  const seat = findDraftSeatByClientId(move.clientId);
  if (!seat) {
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
  seat.isMoved = seat.mesa_id !== seat.originalMesaId || seat.posicion !== seat.originalPosicion;

  state.pendingMove = null;
  const updatedOrigin = updateSeatDom(move.fromMesaId, move.fromPosicion);
  const updatedTarget = updateSeatDom(targetMesaId, targetPos);
  if (!updatedOrigin || !updatedTarget) {
    render();
  }
  refreshHeaderOnly();
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
    isNew: true,
    isMoved: false,
    originalMesaId: null,
    originalPosicion: null,
    clientId: `new-${state.draftCounter}`,
  });

  updateSeatDom(mesaId, posicion) || render();
  refreshHeaderOnly();
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

  const asientosPayload = [];
  for (const seat of state.draft) {
    const baseCambios = seat.cambios || 0;
    const moved =
      seat.id &&
      (seat.mesa_id !== seat.originalMesaId || seat.posicion !== seat.originalPosicion);
    const targetCambios = seat.id ? baseCambios + (moved ? 1 : 0) : 0;

    if (seat.id && moved && targetCambios > 2) {
      ui.info('Ya alcanzaste el límite de 2 cambios para uno de tus asientos.');
      return;
    }

    asientosPayload.push({
      id: seat.id,
      mesa_id: seat.mesa_id,
      posicion: seat.posicion,
      original_mesa_id: seat.originalMesaId,
      original_posicion: seat.originalPosicion,
      cambios: targetCambios,
    });
  }

  try {
    ui.loading('Confirmando selección...');

    const payload = {
      token,
      asientos: asientosPayload,
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