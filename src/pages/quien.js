import { supabase } from '../lib/supabase.js';
import Swal from 'sweetalert2';

const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY;
const storedKey = sessionStorage.getItem('internal_key');

const $ = (s, p = document) => p.querySelector(s);
const tbody = $('#tbody');
const totalesEl = $('#totales');
const searchInput = $('#search');
const btnExport = $('#btnExport');

function formatInt(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function renderRows(rows) {
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'odd:bg-white even:bg-crema/30';
    tr.innerHTML = `
      <td class="p-3 whitespace-nowrap text-center text-azuloscuro">${r.dni || ''}</td>
      <td class="p-3 text-azuloscuro">${r.nombre || ''}</td>
      <td class="p-3 text-center text-azuloscuro">${r.lugar_trabajo || ''}</td>
      <td class="p-3 text-center text-azuloscuro">${formatInt(r.opciones_comun)}</td>
      <td class="p-3 text-center text-azuloscuro">${formatInt(r.opciones_celiacos)}</td>
      <td class="p-3 text-center text-azuloscuro">${formatInt(r.opciones_vegetarianos)}</td>
      <td class="p-3 text-center text-azuloscuro">${formatInt(r.opciones_veganos)}</td>
      <td class="p-3 text-center text-azuloscuro font-semibold">${formatInt(r.opciones)}</td>
      <td class="p-3 text-center text-azuloscuro">${r.es_manual ? 'No' : 'Si'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTotals(rows) {
  const tComun = rows.reduce((acc, r) => acc + formatInt(r.opciones_comun), 0);
  const tCeliacos = rows.reduce((acc, r) => acc + formatInt(r.opciones_celiacos), 0);
  const tVegetarianos = rows.reduce((acc, r) => acc + formatInt(r.opciones_vegetarianos), 0);
  const tVeganos = rows.reduce((acc, r) => acc + formatInt(r.opciones_veganos), 0);
  const tTotal = rows.reduce((acc, r) => acc + formatInt(r.opciones), 0);

  totalesEl.innerHTML = `
    <div class="flex flex-wrap gap-3 items-center">
      <span>Total Comun: <b>${tComun}</b></span>
      <span>· Celíacos: <b>${tCeliacos}</b></span>
      <span>· Vegetarianos: <b>${tVegetarianos}</b></span>
      <span>· Veganos: <b>${tVeganos}</b></span>
      <span class="ml-auto">Total general: <b>${tTotal}</b></span>
    </div>
  `;
}

function toCSV(rows) {
  const header = [
    'dni','nombre', 'lugar_trabajo','opciones_comun','opciones_celiacos','opciones_vegetarianos','opciones_veganos','opciones_total', 'importe_total', 'cuotas', 'importe_cuota', 'por_planilla'
  ];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const vals = [
      r.dni || '',
      r.nombre || '',
      r.lugar_trabajo || '',
      formatInt(r.opciones_comun),
      formatInt(r.opciones_celiacos),
      formatInt(r.opciones_vegetarianos),
      formatInt(r.opciones_veganos),
      formatInt(r.opciones),
      r.es_manual ? formatInt(r.opciones * 25000) : formatInt(r.opciones * 50000),
      r.es_manual ? 3 : 4,
      r.es_manual ? formatInt((r.opciones * 25000)/3) : formatInt((r.opciones * 50000)/4),
      r.es_manual ? 'No' : 'Si',
    ];
    const esc = (v) => {
      const s = String(v).replaceAll('"', '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    lines.push(vals.map(esc).join(','));
  });
  return lines.join('\n');
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function applyFilter(rows, q) {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) =>
    String(r.dni||'').toLowerCase().includes(s) ||
    String(r.nombre||'').toLowerCase().includes(s) ||
    String(r.correo||'').toLowerCase().includes(s)
  );
}

async function loadData() {
  const { data, error } = await supabase
    .from('invitados')
    .select('dni, nombre, lugar_trabajo, opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos, acepto_terminos, opciones, es_manual')
    .eq('acepto_terminos', true)
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
    const renderAll = () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      renderRows(filtered);
      renderTotals(filtered);
    };
    searchInput.addEventListener('input', renderAll);
    btnExport.addEventListener('click', () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      const csv = toCSV(filtered);
      download(`invitados_aceptados_${new Date().toISOString().slice(0,10)}.csv`, csv);
    });
    renderAll();
  } catch (err) {
    console.error(err);
    await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los datos.' });
  }
}

init();
