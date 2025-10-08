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
const retiroSection = $('#retiroSection');
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
      retiroSection.classList.add('hidden');
      return;
    }

    if (data.retiro === true) {
      dniValido = false;
      ui.info('Este DNI ya retiró sus entradas.');
      retiroSection.classList.add('hidden');
      return;
    }

    // Guardar invitado global
    invitado = data;
    dniValido = true;
    nombreInput.value = data.nombre || '';
    correoInput.value = data.correo || '';

    // Calcular total de menús
    comunInput.value = data.opciones_comun || 0;
    celiacosInput.value = data.opciones_celiacos || 0;
    vegetarianosInput.value = data.opciones_vegetarianos || 0;
    veganosInput.value = data.opciones_veganos || 0;

    const total = totalMenus();
    totalNum.textContent = total;

    // Obtener pulseras disponibles
    const { data: libres, error: errLibres } = await supabase
      .from('entradas')
      .select('numero')
      .eq('entregado', false)
      .order('numero', { ascending: true })
      .limit(total);

    if (errLibres) throw errLibres;

    numerosPulseras = (libres || []).map((e) => e.numero);
    mostrarPulseras(numerosPulseras);

    ui.success('DNI validado correctamente.');
    retiroSection.classList.remove('hidden');
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('Error al verificar el DNI.');
    retiroSection.classList.add('hidden');
  }
});

// ---- Envío de formulario ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!dniValido || !invitado) return ui.error('Validá primero el DNI.');

  const total = totalMenus();
  if (total < 1) return ui.info('El total de menús debe ser mayor a 0.');

  if (!numerosPulseras.length) {
    return ui.info('No hay pulseras disponibles.');
  }

  const payload = {
    invitado,
    numeros: numerosPulseras,
    comun: int(comunInput.value),
    celiacos: int(celiacosInput.value),
    vegetarianos: int(vegetarianosInput.value),
    veganos: int(veganosInput.value),
    total,
  };

  try {
    ui.loading('Registrando retiro...');

    // 1️⃣ Marcar invitado como retirado
    const { error: errInv } = await supabase
      .from('invitados')
      .update({ retiro: true })
      .eq('id', invitado.id);
    if (errInv) throw errInv;

    // 2️⃣ Marcar las entradas como entregadas
    const { error: errEntradas } = await supabase
      .from('entradas')
      .update({ entregado: true, dni_titular: invitado.dni })
      .in('numero', numerosPulseras);
    if (errEntradas) throw errEntradas;

    // 3️⃣ Enviar correo de confirmación
    const msg = await post(ENDPOINT, payload);

    ui.close();
    ui.success('Retiro registrado y correo enviado.');
    console.log('Correo:', msg);

    // Reset
    form.reset();
    numerosPulseras = [];
    pulserasContainer.classList.add('hidden');
    retiroSection.classList.add('hidden');
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error('No se pudo registrar el retiro.');
  }
});

$('#anio').textContent = new Date().getFullYear();
