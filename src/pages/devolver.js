import { supabase } from '../lib/supabase.js';
import Swal from 'sweetalert2';

const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY;
const storedKey = sessionStorage.getItem('internal_key');

const $ = (s, p = document) => p.querySelector(s);
const dniInput = $('#dni');
const info = $('#info');
const nombreEl = $('#nombre');
const pulserasBox = $('#pulserasBox');
const pulserasEl = $('#pulseras');
const btnDevolver = $('#btnDevolver');

function tag(text) {
  const span = document.createElement('span');
  span.textContent = text;
  span.className = 'bg-celeste text-azuloscuro px-3 py-1 rounded-full font-medium shadow-sm';
  return span;
}

async function ensureAccess() {
  if (storedKey === ACCESS_KEY) return true;
  const { value: clave } = await Swal.fire({
    title: 'Acceso restringido',
    input: 'password',
    inputLabel: 'Ingresá la clave de acceso',
    inputPlaceholder: '••••••',
    confirmButtonText: 'Entrar',
    background: '#f1faee',
    color: '#1d3557',
    allowOutsideClick: false,
  });
  if (clave === ACCESS_KEY) {
    sessionStorage.setItem('internal_key', clave);
    return true;
  }
  await Swal.fire({ icon: 'error', title: 'Clave incorrecta', text: 'No tenés autorización para acceder.' });
  return ensureAccess();
}

async function getPulseras(dni) {
  const { data, error } = await supabase
    .from('entradas')
    .select('numero')
    .eq('dni_titular', dni)
    .eq('entregado', true)
    .order('numero', { ascending: true });
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((r) => r.numero);
}

function showPulseras(nums) {
  if (!nums || nums.length === 0) {
    pulserasEl.innerHTML = '';
    pulserasBox.classList.add('hidden');
    return;
  }
  pulserasEl.innerHTML = '';
  nums.forEach((n) => pulserasEl.appendChild(tag(`#${n}`)));
  pulserasBox.classList.remove('hidden');
}

async function buscarDNI() {
  const dni = dniInput.value.trim();
  info.classList.add('hidden');
  btnDevolver.disabled = true;
  pulserasBox.classList.add('hidden');
  pulserasEl.innerHTML = '';
  nombreEl.textContent = '';
  if (!dni) return;

  Swal.showLoading();
  try {
    const { data, error } = await supabase
      .from('invitados')
      .select('nombre, retiro, estado')
      .eq('dni', dni)
      .maybeSingle();
    Swal.close();
    if (error || !data) {
      await Swal.fire({ icon: 'error', title: 'DNI no encontrado' });
      return;
    }
    nombreEl.textContent = data.nombre || '';
    info.classList.remove('hidden');

    const pul = await getPulseras(dni);
    showPulseras(pul);
    if (pul.length === 0) {
      await Swal.fire({ icon: 'info', title: 'Sin pulseras entregadas', text: 'Este DNI no tiene pulseras para devolver.' });
      btnDevolver.disabled = true;
      return;
    }
    btnDevolver.disabled = false;
  } catch (e) {
    Swal.close();
    console.error(e);
    await Swal.fire({ icon: 'error', title: 'Error al buscar el DNI' });
  }
}

async function registrarDevolucion() {
  const dni = dniInput.value.trim();
  if (!dni) return;
  const ENDPOINT = import.meta.env.DEV
    ? 'https://cena-unsj.vercel.app/api/devolver'
    : '/api/devolver';
  try {
    Swal.showLoading();
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni }),
    });
    const data = await resp.json();
    Swal.close();
    if (!resp.ok) throw new Error(data?.error || 'No se pudo registrar la devolución');

    showPulseras([]);
    btnDevolver.disabled = true;
    await Swal.fire({ icon: 'success', title: 'Devolución registrada', html: `Se devolvieron: <b>${(data.numeros||[]).map(n=>`#${n}`).join(' ')}</b>` });
  } catch (e) {
    Swal.close();
    console.error(e);
    await Swal.fire({ icon: 'error', title: 'Error', text: e.message || 'No se pudo registrar la devolución' });
  }
}

$('#anio').textContent = new Date().getFullYear();

(async () => {
  await ensureAccess();
  dniInput.addEventListener('blur', buscarDNI);
  btnDevolver.addEventListener('click', registrarDevolucion);
})();
