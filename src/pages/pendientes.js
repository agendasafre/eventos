import { supabase } from '../lib/supabase.js';
import Swal from 'sweetalert2';

const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY;
const storedKey = sessionStorage.getItem('internal_key');

const $ = (s, p = document) => p.querySelector(s);
const tbody = $('#tbody');
const totalesEl = $('#totales');
const searchInput = $('#search');
const btnExport = $('#btnExport');

function int(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function rowTotal(r) {
  return int(r.opciones_comun) + int(r.opciones_celiacos) + int(r.opciones_vegetarianos) + int(r.opciones_veganos);
}

function renderRows(rows) {
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'odd:bg-white even:bg-crema/30';
    tr.innerHTML = `
      <td class="p-3 whitespace-nowrap">${r.dni || ''}</td>
      <td class="p-3">${r.nombre || ''}</td>
      <td class="p-3">${r.correo || ''}</td>
      <td class="p-3">${r.lugar_trabajo || ''}</td>
      <td class="p-3 text-right">${int(r.opciones_comun)}</td>
      <td class="p-3 text-right">${int(r.opciones_celiacos)}</td>
      <td class="p-3 text-right">${int(r.opciones_vegetarianos)}</td>
      <td class="p-3 text-right">${int(r.opciones_veganos)}</td>
      <td class="p-3 text-right font-semibold">${rowTotal(r)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTotals(rows) {
  const tComun = rows.reduce((a, r) => a + int(r.opciones_comun), 0);
  const tCelia = rows.reduce((a, r) => a + int(r.opciones_celiacos), 0);
  const tVege = rows.reduce((a, r) => a + int(r.opciones_vegetarianos), 0);
  const tVega = rows.reduce((a, r) => a + int(r.opciones_veganos), 0);
  const tTotal = tComun + tCelia + tVege + tVega;

  totalesEl.innerHTML = `
    <div class="flex flex-wrap gap-3 items-center">
      <span>Total Común: <b>${tComun}</b></span>
      <span>· Celíacos: <b>${tCelia}</b></span>
      <span>· Vegetarianos: <b>${tVege}</b></span>
      <span>· Veganos: <b>${tVega}</b></span>
      <span class="ml-auto">Total general: <b>${tTotal}</b></span>
    </div>
  `;
}

function toCSV(rows) {
  const header = ['dni','nombre','correo','lugar_trabajo','opciones_comun','opciones_celiacos','opciones_vegetarianos','opciones_veganos','total'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const vals = [
      r.dni || '', r.nombre || '', r.correo || '', r.lugar_trabajo || '',
      int(r.opciones_comun), int(r.opciones_celiacos), int(r.opciones_vegetarianos), int(r.opciones_veganos), rowTotal(r),
    ];
    const esc = (v) => {
      const s = String(v).replaceAll('"', '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    lines.push(vals.map(esc).join(','));
  });
  return lines.join('\n');
}

function downloadCSV(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
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
  // Registrados y aun no retirados (retiro false o null), con opciones > 0
  const { data, error } = await supabase
    .from('invitados')
    .select('dni, nombre, correo, lugar_trabajo, estado, retiro, opciones, opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos')
    .eq('estado', 'registrado')
    .or('retiro.is.false,retiro.is.null')
    .gt('opciones', 0)
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
    const rerender = () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      renderRows(filtered);
      renderTotals(filtered);
    };
    searchInput.addEventListener('input', rerender);
    btnExport.addEventListener('click', () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      const csv = toCSV(filtered);
      downloadCSV(`pendientes_retiro_${new Date().toISOString().slice(0,10)}.csv`, csv);
    });
    rerender();
  } catch (err) {
    console.error(err);
    await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los datos.' });
  }
}

init();
