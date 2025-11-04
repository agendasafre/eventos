import { supabase } from '../lib/supabase.js';
import Swal from 'sweetalert2';

const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY;
const storedKey = sessionStorage.getItem('internal_key');

const $ = (s, p = document) => p.querySelector(s);
const tbody = $('#tbody');
const totalesEl = $('#totales');
const searchInput = $('#search');
const btnExportCsv = $('#btnExportCsv');
// XLSX eliminado

function i(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

// Campo por planilla removido de la vista

async function getPulserasMap(dnis) {
  if (!Array.isArray(dnis) || dnis.length === 0) return new Map();
  const { data, error } = await supabase
    .from('entradas')
    .select('dni_titular, numero')
    .in('dni_titular', dnis)
    .eq('entregado', true);
  if (error) {
    console.error(error);
    return new Map();
  }
  const map = new Map();
  (data || []).forEach(({ dni_titular, numero }) => {
    const key = String(dni_titular || '');
    const arr = map.get(key) || [];
    arr.push(numero);
    map.set(key, arr);
  });
  map.forEach((arr) => arr.sort((a, b) => (a ?? 0) - (b ?? 0)));
  return map;
}

async function renderRows(rows) {
  tbody.innerHTML = '';
  const dnis = Array.from(new Set(rows.map((r) => String(r.dni || '')).filter(Boolean)));
  const pulserasMap = await getPulserasMap(dnis);
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'odd:bg-white even:bg-crema/30';
    const pul = pulserasMap.get(String(r.dni || '')) || [];
    const pulStr = pul.length ? pul.map((n) => `#${n}`).join(', ') : '';
    tr.innerHTML = `
      <td class="p-3 whitespace-nowrap text-azuloscuro">${r.dni ?? ''}</td>
      <td class="p-3 text-azuloscuro">${r.nombre ?? ''}</td>
      <td class="p-3 text-center text-azuloscuro font-semibold">${i(r.opciones)}</td>
      <td class="p-3 text-azuloscuro">${pulStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTotals(rows) {
  const tTotal = rows.reduce((acc, r) => acc + i(r.opciones), 0);

  totalesEl.innerHTML = `
    <div class="flex flex-wrap gap-3 items-center">
      <span class="ml-auto">Total general: <b>${tTotal}</b></span>
    </div>
  `;
}

function applyFilter(rows, q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) =>
    String(r.dni || '').toLowerCase().includes(s) ||
    String(r.nombre || '').toLowerCase().includes(s)
  );
}

function toCSV(rows, pulserasMap) {
  const header = [
    'dni','nombre','opciones_total','pulseras','importe_total','cuotas','importe_cuota','por_planilla'
  ];
  const lines = [header.join(',')];
  const esc = (v) => {
    const s = String(v ?? '').replaceAll('"', '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  rows.forEach((r) => {
    const pul = pulserasMap?.get(String(r.dni || '')) || [];
    const pulStr = pul.length ? pul.map((n) => `#${n}`).join(' ') : '';
    const opciones = i(r.opciones);
    const esManual = !!r.es_manual;
    const importeTotal = esManual ? i(opciones * 25000) : i(opciones * 50000);
    const cuotas = esManual ? 3 : 4;
    const importeCuota = esManual ? i((opciones * 25000) / 3) : i((opciones * 50000) / 4);
    const vals = [
      r.dni || '',
      r.nombre || '',
      opciones,
      pulStr,
      importeTotal,
      cuotas,
      importeCuota,
      esManual ? 'No' : 'Si',
    ];
    lines.push(vals.map(esc).join(','));
  });
  return lines.join('\n');
}

// función XLSX eliminada

async function loadData() {
  const { data, error } = await supabase
    .from('invitados')
    .select('dni, nombre, opciones, es_manual')
    .eq('retiro', true)
    .order('dni', { ascending: true });
  if (error) throw error;
  return data || [];
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

async function init() {
  $('#anio').textContent = new Date().getFullYear();
  await ensureAccess();

  try {
    let rows = await loadData();
    const renderAll = async () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      await renderRows(filtered);
      renderTotals(filtered);
    };
    searchInput.addEventListener('input', renderAll);
    btnExportCsv.addEventListener('click', async () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      const dnis = Array.from(new Set(filtered.map((r) => String(r.dni || '')).filter(Boolean)));
      const map = await getPulserasMap(dnis);
      const csv = toCSV(filtered, map);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retirados_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
    // Exportación XLSX eliminada

  await renderAll();
  } catch (err) {
    console.error(err);
    await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los datos.' });
  }
}

init();
