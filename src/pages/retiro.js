import { supabase } from '../lib/supabase.js';
import { post } from '../lib/api.js';
import { ui } from '../ui.js';

const ENDPOINT = import.meta.env.DEV
  ? 'https://cena-unsj.vercel.app/api/retirar'
  : '/api/retirar';

const $ = (s, p = document) => p.querySelector(s);

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
let numerosPulseras = [];

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
  submitBtn.disabled = !dniValido || total < 1;
}

// Mostrar pulseras visualmente
function mostrarPulseras(numeros) {
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

// ---- Validar DNI ----
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
      return;
    }

    invitado = data;
    nombreInput.value = data.nombre || '';
    correoInput.value = data.correo || '';

    // 🟡 Caso 1: no aceptó términos
    if (!data.acepto_terminos) {
      dniValido = false;
      ui.info('El invitado no aceptó los términos.');
      bloquearInputs(true);
      return;
    }

    // 🟢 Caso 2: ya retiró
    if (data.retiro === true) {
      dniValido = false;
      ui.info('Este invitado ya retiró sus pulseras.');
      bloquearInputs(true);

      // Mostrar info opcional
      const { data: pulseras } = await supabase
        .from('entradas')
        .select('numero')
        .eq('dni_titular', dni)
        .order('numero');
      if (pulseras?.length) mostrarPulseras(pulseras.map((p) => p.numero));

      return;
    }

    // 🟢 Caso 3: habilitado para retiro
    dniValido = true;
    [comunInput, celiacosInput, vegetarianosInput, veganosInput].forEach((el) =>
      el.removeAttribute('readonly')
    );

    comunInput.value = data.opciones_comun || 0;
    celiacosInput.value = data.opciones_celiacos || 0;
    vegetarianosInput.value = data.opciones_vegetarianos || 0;
    veganosInput.value = data.opciones_veganos || 0;

    actualizarUI();
    ui.success('DNI validado correctamente. Podés registrar el retiro.');
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('Error al verificar el DNI.');
  }
});

function bloquearInputs(bloquear = true) {
  const fields = [
    comunInput,
    celiacosInput,
    vegetarianosInput,
    veganosInput,
    submitBtn,
  ];
  fields.forEach((el) => {
    if (bloquear) el.setAttribute('readonly', true);
    else el.removeAttribute('readonly');
  });
  submitBtn.disabled = bloquear;
}

// ---- Recalcular total de menús ----
[comunInput, celiacosInput, vegetarianosInput, veganosInput].forEach((el) => {
  el.addEventListener('input', actualizarUI);
});

// ---- Envío de formulario ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dniValido || !invitado) return ui.error('Validá primero el DNI.');

  const total = totalMenus();
  if (total < 1) return ui.info('El total de menús debe ser mayor a 0.');

  try {
    ui.loading('Registrando retiro...');

    // Obtener pulseras disponibles según total
    const { data: libres, error: errLibres } = await supabase
      .from('entradas')
      .select('numero')
      .eq('entregado', false)
      .order('numero', { ascending: true })
      .limit(total);
    if (errLibres) throw errLibres;

    numerosPulseras = (libres || []).map((e) => e.numero);

    if (!numerosPulseras.length) {
      ui.close();
      return ui.info('No hay pulseras disponibles.');
    }

    // Actualizar invitado
    const { error: errInv } = await supabase
      .from('invitados')
      .update({
        retiro: true,
        opciones_comun: int(comunInput.value),
        opciones_celiacos: int(celiacosInput.value),
        opciones_vegetarianos: int(vegetarianosInput.value),
        opciones_veganos: int(veganosInput.value),
      })
      .eq('id', invitado.id);
    if (errInv) throw errInv;

    // Actualizar entradas
    const { error: errEntradas } = await supabase
      .from('entradas')
      .update({ entregado: true, dni_titular: invitado.dni })
      .in('numero', numerosPulseras);
    if (errEntradas) throw errEntradas;

    // Mostrar visualmente las pulseras asignadas
    mostrarPulseras(numerosPulseras);

    // Enviar correo
    const payload = {
      invitado,
      numeros: numerosPulseras,
      comun: int(comunInput.value),
      celiacos: int(celiacosInput.value),
      vegetarianos: int(vegetarianosInput.value),
      veganos: int(veganosInput.value),
      total,
    };

    const msg = await post(ENDPOINT, payload);

    ui.close();
    ui.success('Retiro registrado y correo enviado.');
    console.log('Correo:', msg);

    // Reset visual
    bloquearInputs(true);
    dniValido = false;
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('No se pudo registrar el retiro.');
  }
});

$('#anio').textContent = new Date().getFullYear();
