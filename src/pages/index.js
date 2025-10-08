import { supabase } from '../lib/supabase.js';
import { post } from '../lib/api.js';
import { ui } from '../ui.js';

const ENDPOINT = '/api/register';
const FECHA_LIMITE = new Date('2025-11-28T23:59:59');

const $ = (sel, parent = document) => parent.querySelector(sel);

// Elementos
const form = $('#form');
const dniInput = $('#dni');
const nombreInput = $('#nombre');
const correoInput = $('#correo');
const lugarSelect = $('#lugar');
const comunInput = $('#comun');
const celiacosInput = $('#celiacos');
const vegetarianosInput = $('#vegetarianos');
const veganosInput = $('#veganos');
const totalNum = $('#totalNum');
const errorMsg = $('#errorMsg');
const submitBtn = $('#submitBtn');

// Estado interno
let dniValido = false;

// Helpers
const int = (v) => (Number.isNaN(parseInt(v, 10)) ? 0 : parseInt(v, 10));
const emailOk = (v) => /\S+@\S+\.\S+/.test(v);

function calcularTotal() {
  const total =
    int(comunInput.value) +
    int(celiacosInput.value) +
    int(vegetarianosInput.value) +
    int(veganosInput.value);
  totalNum.textContent = total;
  if (total < 1) {
    errorMsg.classList.remove('hidden');
  } else {
    errorMsg.classList.add('hidden');
  }
  return total;
}

function actualizarUI() {
  const total = calcularTotal();
  const ok =
    dniValido &&
    nombreInput.value.trim() !== '' &&
    emailOk(correoInput.value) &&
    lugarSelect.value.trim() !== '' &&
    total >= 1;

  submitBtn.disabled = !ok;
}

// Asignar eventos a inputs
[comunInput, celiacosInput, vegetarianosInput, veganosInput].forEach((el) => {
  el.addEventListener('input', actualizarUI);
});
[nombreInput, correoInput, lugarSelect].forEach((el) => {
  el.addEventListener('input', actualizarUI);
});

// Validar DNI
dniInput.addEventListener('blur', async () => {
  const dni = dniInput.value.trim();
  if (!dni) return;

  ui.loading('Verificando DNI...');
  try {
    const { data, error } = await supabase
      .from('invitados')
      .select('id, nombre, retiro')
      .eq('dni', dni)
      .maybeSingle();
    ui.close();

    if (error || !data) {
      dniValido = false;
      actualizarUI();
      form.reset();
      dniInput.focus();
      return ui.error('DNI no habilitado.');
    }

    if (data.retiro === true) {
      dniValido = false;
      actualizarUI();
      form.reset();
      return ui.info('Este DNI ya retiró su entrada.');
    }

    dniValido = true;
    actualizarUI();
    ui.success('DNI validado correctamente.');
    nombreInput.focus();
  } catch (err) {
    ui.close();
    dniValido = false;
    actualizarUI();
    ui.error('Error al verificar el DNI.');
    form.reset();
    dniInput.focus();
    console.error(err);
  }
});

// Envío de formulario
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (new Date() > FECHA_LIMITE) {
    return ui.info('El período de registro ha finalizado.');
  }

  if (submitBtn.disabled) return;

  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    ui.loading('Enviando registro...');
    const msg = await post(ENDPOINT, payload);
    ui.close();
    ui.success(msg);
    console.log(msg);
    // Reset
    form.reset();
    dniValido = false;
    actualizarUI();
  } catch (err) {
    ui.close();
    ui.error(err.message || 'No se pudo completar el registro.');
  }
});

// Estado inicial
submitBtn.disabled = true;
actualizarUI();
$('#anio').textContent = new Date().getFullYear();
dniInput.focus();