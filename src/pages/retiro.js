import { supabase } from '../lib/supabase.js';
import { ui } from '../ui.js';

// En dev podés pegar la URL de Vercel si no tenés proxy:
const ENDPOINT = import.meta.env.DEV
  ? 'https://cena-unsj.vercel.app/api/retirar'
  : '/api/retirar';

const $ = (s, p = document) => p.querySelector(s);

// DOM
const form = $('#form');
const dniInput = $('#dni');
const nombreInput = $('#nombre');
const correoInput = $('#correo');
const comunInput = $('#comun');
const celiacosInput = $('#celiacos');
const vegetarianosInput = $('#vegetarianos');
const veganosInput = $('#veganos');
const totalNum = $('#totalNum');
const pulserasContainer = $('#pulserasContainer');
const listaPulseras = $('#listaPulseras');
const submitBtn = $('#submitBtn');
const datosInvitadoSection = $('#datosInvitado');

const camposFormulario = [
  nombreInput,
  correoInput,
  comunInput,
  celiacosInput,
  vegetarianosInput,
  veganosInput,
];

const camposMenu = [comunInput, celiacosInput, vegetarianosInput, veganosInput];

let invitado = null;
let dniValido = false;

function resetFormulario() {
  nombreInput.value = '';
  correoInput.value = '';
  camposMenu.forEach((el) => {
    el.value = '0';
  });
  totalNum.textContent = '0';
  listaPulseras.innerHTML = '';
  pulserasContainer.classList.add('hidden');
}

function ocultarFormulario({ reset = true } = {}) {
  datosInvitadoSection.classList.add('hidden');
  camposFormulario.forEach((el) => {
    el.disabled = true;
  });
  submitBtn.disabled = true;
  if (reset) resetFormulario();
}

function mostrarFormulario() {
  datosInvitadoSection.classList.remove('hidden');
  camposFormulario.forEach((el) => {
    el.disabled = false;
  });
  actualizarUI();
}

function deshabilitarFormulario() {
  camposFormulario.forEach((el) => {
    el.disabled = true;
  });
  submitBtn.disabled = true;
}

// ---- Helpers ----
const int = (v) => (Number.isNaN(parseInt(v, 10)) ? 0 : parseInt(v, 10));
function totalMenus() {
  return (
    int(comunInput.value) +
    int(celiacosInput.value) +
    int(vegetarianosInput.value) +
    int(veganosInput.value)
  );
}

function actualizarUI() {
  const total = totalMenus();
  totalNum.textContent = total;
  const nombreOk = nombreInput.value.trim().length > 0;
  const correoOk = correoInput.value.trim().length > 0;
  submitBtn.disabled = !dniValido || nombreInput.disabled;
}

function mostrarPulseras(numeros) {
  if (!Array.isArray(numeros)) return;
  listaPulseras.innerHTML = '';
  numeros.forEach((n) => {
    const span = document.createElement('span');
    span.textContent = `#${n}`;
    span.className =
      'bg-celeste text-azuloscuro px-3 py-1 rounded-full font-medium shadow-sm';
    listaPulseras.appendChild(span);
  });
  pulserasContainer.classList.remove('hidden');
}

async function obtenerPulserasPorDNI(dni, limit = null) {
  const q = supabase
    .from('entradas')
    .select('numero')
    .eq('dni_titular', dni)
    .eq('entregado', true)
    .order('numero', { ascending: true });

  const { data, error } = limit ? await q.limit(limit) : await q;
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((r) => r.numero);
}

ocultarFormulario();

// ---- Validar DNI ----
dniInput.addEventListener('blur', async () => {
  const dni = dniInput.value.trim();
  if (!dni) {
    invitado = null;
    dniValido = false;
    ocultarFormulario();
    return;
  }

  invitado = null;
  dniValido = false;
  ocultarFormulario();

  ui.loading('Verificando DNI...');
  try {
    const { data, error } = await supabase
      .from('invitados')
      .select('*')
      .eq('dni', dni)
      .maybeSingle();

    ui.close();

    if (error || !data) {
      ui.error('DNI no encontrado o no habilitado.');
      return;
    }

    invitado = data;
    if (data.retiro === true || data.estado === 'retirado') {
      nombreInput.value = data.nombre || '';
      correoInput.value = data.correo || '';
      comunInput.value = int(data.opciones_comun);
      celiacosInput.value = int(data.opciones_celiacos);
      vegetarianosInput.value = int(data.opciones_vegetarianos);
      veganosInput.value = int(data.opciones_veganos);
      totalNum.textContent = totalMenus();
      deshabilitarFormulario();
      datosInvitadoSection.classList.remove('hidden');
      ui.info('Este invitado ya retiró sus entradas.');
      const numeros = await obtenerPulserasPorDNI(dni);
      if (numeros.length) {
        mostrarPulseras(numeros);
      }
      invitado = null;
      return;
    }

    if (data.estado !== 'registrado') {
      ui.info('El invitado no completó el registro.');
      invitado = null;
      return;
    }

    nombreInput.value = data.nombre || '';
    correoInput.value = data.correo || '';
    comunInput.value = int(data.opciones_comun);
    celiacosInput.value = int(data.opciones_celiacos);
    vegetarianosInput.value = int(data.opciones_vegetarianos);
    veganosInput.value = int(data.opciones_veganos);

    pulserasContainer.classList.add('hidden');
    listaPulseras.innerHTML = '';
    dniValido = true;
    mostrarFormulario();
    actualizarUI();
    ui.success(`Invitado validado. Total de menús: ${totalMenus()}.`);
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('Error al verificar el DNI.');
    invitado = null;
    dniValido = false;
  }
});

// ---- Cambios en campos editables ----
camposMenu.forEach((el) => {
  el.addEventListener('input', () => {
    const valor = int(el.value);
    el.value = valor < 0 ? '0' : `${valor}`;
    actualizarUI();
  });
});

[nombreInput, correoInput].forEach((el) => {
  el.addEventListener('input', actualizarUI);
});

// ---- Confirmar retiro (server-side via /api/retirar) ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dniValido || !invitado) return ui.error('Validá primero el DNI.');

  const errores = [];
  const nombre = nombreInput.value.trim();
  const correo = correoInput.value.trim();
  const total = totalMenus();

  if (!nombre) errores.push('Completá el nombre.');
  if (!correo) errores.push('Completá el correo.');
  if (total < 1) errores.push('Seleccioná al menos un menú.');

  if (errores.length) {
    ui.info(errores.join(' '));
    if (!nombre) {
      nombreInput.focus();
    } else if (!correo) {
      correoInput.focus();
    } else {
      comunInput.focus();
    }
    return;
  }
  
  try {
    ui.loading('Registrando retiro...');

    const payload = {
      dni: invitado.dni,
      nombre: nombreInput.value.trim(),
      correo: correoInput.value.trim(),
      comun: int(comunInput.value),
      celiacos: int(celiacosInput.value),
      vegetarianos: int(vegetarianosInput.value),
      veganos: int(veganosInput.value),
    };

    // Llamado directo para poder leer el JSON (si tu helper post ya devuelve JSON, usalo)
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || 'Error en retiro');

    // 👇 Mostrar SOLO las pulseras recién asignadas
    mostrarPulseras(data.numeros);

    ui.close();
    ui.success(data?.message || 'Retiro registrado y correo enviado.');
    deshabilitarFormulario();
    dniValido = false;
    invitado.retiro = true;
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error(err.message || 'No se pudo registrar el retiro.');
  }
});

$('#anio').textContent = new Date().getFullYear();
