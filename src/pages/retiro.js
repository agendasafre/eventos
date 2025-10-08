import { supabase } from '../lib/supabase.js';
import { post } from '../lib/api.js';
import { ui } from '../ui.js';

// Endpoint según entorno (local o deployado)
const ENDPOINT = '/api/retirar';
const FECHA_LIMITE = new Date('2025-11-28T23:59:59');

const $ = (s, p = document) => p.querySelector(s);

// Elementos del DOM
const form = $('#form');
const dniInput = $('#dni');
const retiroSection = $('#retiroSection');
const comunInput = $('#comun');
const celiacosInput = $('#celiacos');
const vegetarianosInput = $('#vegetarianos');
const veganosInput = $('#veganos');
const submitBtn = $('#submitBtn');

let invitado = null;

// Helper
const int = (v) => (Number.isNaN(parseInt(v, 10)) ? 0 : parseInt(v, 10));

// Función para recalcular total y habilitar/deshabilitar botón
function actualizarUI() {
  const total =
    int(comunInput.value) +
    int(celiacosInput.value) +
    int(vegetarianosInput.value) +
    int(veganosInput.value);

  submitBtn.disabled = !(invitado && total > 0);
  return total;
}

// Escuchar cambios en los inputs de cantidad
[comunInput, celiacosInput, vegetarianosInput, veganosInput].forEach((el) =>
  el.addEventListener('input', actualizarUI)
);

// Validar DNI en Supabase
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
      invitado = null;
      retiroSection.classList.add('hidden');
      return ui.error('DNI no encontrado o no habilitado.');
    }

    if (data.retiro === true) {
      invitado = null;
      retiroSection.classList.add('hidden');
      return ui.info('Este invitado ya retiró sus entradas.');
    }

    invitado = data;

    retiroSection.classList.remove('hidden');
    
    // Precargar valores desde la base
    comunInput.value = data.opciones_comun || 0;
    celiacosInput.value = data.opciones_celiacos || 0;
    vegetarianosInput.value = data.opciones_vegetarianos || 0;
    veganosInput.value = data.opciones_veganos || 0;

    // Recalcular total y habilitar/deshabilitar botón
    actualizarUI();
    ui.success(`Invitado: ${data.nombre}`);

    comunInput.focus();
  } catch (err) {
    ui.close();
    retiroSection.classList.add('hidden');
    invitado = null;
    ui.error('Error al verificar el DNI.');
    console.error(err);
  }
});

// Envío del formulario
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!invitado) return ui.error('Primero validá un DNI.');

  const total = actualizarUI();
  if (total < 1) return ui.error('Debés registrar al menos un menú retirado.');

  if (new Date() > FECHA_LIMITE) {
    return ui.info('⏰ El período de retiro ha finalizado.');
  }

  const payload = {
    dni: invitado.dni,
    comun: int(comunInput.value),
    celiacos: int(celiacosInput.value),
    vegetarianos: int(vegetarianosInput.value),
    veganos: int(veganosInput.value),
  };

  try {
    ui.loading('Registrando retiro...');
    const msg = await post(ENDPOINT, payload);
    ui.close();
    ui.success(msg);

    // Reset
    form.reset();
    retiroSection.classList.add('hidden');
    invitado = null;
    submitBtn.disabled = true;
  } catch (err) {
    ui.close();
    ui.error(err.message || 'Error al confirmar el retiro.');
    console.error(err);
  }
});

// Año en el footer
$('#anio').textContent = new Date().getFullYear();
