import { supabase } from '../lib/supabase.js';
import { post } from '../lib/api.js';
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

let invitado = null;
let dniValido = false;

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

function bloquearInputs(bloquear = true) {
  const fields = [comunInput, celiacosInput, vegetarianosInput, veganosInput];
  fields.forEach((el) => {
    if (bloquear) el.setAttribute('readonly', true);
    else el.removeAttribute('readonly');
  });
  submitBtn.disabled = bloquear || totalMenus() < 1;
}

function actualizarUI() {
  const total = totalMenus();
  totalNum.textContent = total;
  submitBtn.disabled = !dniValido || total < 1;
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

// ---- Validar DNI (flujo original) ----
dniInput.addEventListener('blur', async () => {
  const dni = dniInput.value.trim();
  if (!dni) return;

  ui.loading('Verificando DNI...');
  try {
    const { data, error } = await supabase
      .from('invitados')
      .select('*')
      .eq('dni', dni)
      .maybeSingle();

    ui.close();

    if (error || !data) {
      dniValido = false;
      ui.error('DNI no encontrado o no habilitado.');
      bloquearInputs(true);
      return;
    }

    invitado = data;
    nombreInput.value = data.nombre || '';
    correoInput.value = data.correo || '';

    // 1) Debe haber aceptado términos
    if (!data.acepto_terminos) {
      dniValido = false;
      ui.info('El invitado no aceptó los términos.');
      bloquearInputs(true);
      return;
    }

    // 2) Si ya retiró: feedback + bloqueo + mostrar pulseras asignadas
    if (data.retiro === true) {
      dniValido = false;
      ui.info('Este invitado ya retiró sus pulseras.');
      bloquearInputs(true);
      const yaEntregadas = await obtenerPulserasPorDNI(dni);
      if (yaEntregadas.length) mostrarPulseras(yaEntregadas);
      return;
    }

    // 3) Habilitar edición de menús y validación
    comunInput.value = data.opciones_comun || 0;
    celiacosInput.value = data.opciones_celiacos || 0;
    vegetarianosInput.value = data.opciones_vegetarianos || 0;
    veganosInput.value = data.opciones_veganos || 0;

    dniValido = true;
    bloquearInputs(false);
    actualizarUI();
    ui.success('DNI validado. Podés registrar el retiro.');
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('Error al verificar el DNI.');
    bloquearInputs(true);
  }
});

// ---- Cambios en cantidades de menú ----
[comunInput, celiacosInput, vegetarianosInput, veganosInput].forEach((el) => {
  el.addEventListener('input', actualizarUI);
});

// ---- Confirmar retiro (server-side via /api/retirar) ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dniValido || !invitado) return ui.error('Validá primero el DNI.');

  const total = totalMenus();
  if (total < 1) return ui.info('El total de menús debe ser mayor a 0.');

  try {
    ui.loading('Registrando retiro...');

    // 👉 El serverless /api/retirar hace:
    // - valida invitado y estado
    // - asigna N pulseras disponibles
    // - marca invitado.retiro = true y actualiza opciones_*
    // - marca entradas.entregado = true y dni_titular = dni
    // - envía mailRetiro por Apps Script
    const payload = {
      dni: invitado.dni,
      comun: int(comunInput.value),
      celiacos: int(celiacosInput.value),
      vegetarianos: int(vegetarianosInput.value),
      veganos: int(veganosInput.value),
    };

    // El helper `post` suele devolver texto; si devolvés JSON en /api/retirar
    // podés adaptarlo acá (p.ej. JSON.parse).
    await post(ENDPOINT, payload);

    // Traigo las pulseras recién asignadas para mostrarlas
    const numeros = await obtenerPulserasPorDNI(invitado.dni, total);
    if (numeros.length) mostrarPulseras(numeros);

    ui.close();
    ui.success('Retiro registrado y correo enviado.');

    // Bloquear para evitar doble operación
    bloquearInputs(true);
    dniValido = false;
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('No se pudo registrar el retiro.');
  }
});

$('#anio').textContent = new Date().getFullYear();
