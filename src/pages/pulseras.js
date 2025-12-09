import { supabase } from '../lib/supabase.js';
import Swal from 'sweetalert2';

const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY;
const storedKey = sessionStorage.getItem('internal_key');

const $ = (s, p = document) => p.querySelector(s);
const tbody = $('#tbody');
const searchInput = $('#search');
const btnExportCsv = $('#btnExportCsv');

function esc(v) {
  const s = String(v ?? '').replaceAll('"', '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
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

async function loadRows() {
  // 1) Pulseras sorteadas (solo interesan las que tienen sorteada=true)
  let entradas = [];
  try {
    const resp = await supabase
      .from('entradas')
      .select('numero, dni_titular, sorteado')
      .eq('sorteado', true)
      .order('dni_titular', { ascending: true })
      .order('numero', { ascending: true });
    if (resp.error) throw resp.error;
    entradas = resp.data || [];
  } catch (e) {
    console.error('Fallo al consultar sorteado=true, reintentando entregadas:', e);
    // Fallback: si la columna no existe o no permite el filtro, traer entregadas
    const alt = await supabase
      .from('entradas')
      .select('numero, dni_titular')
      .eq('entregado', true)
      .order('dni_titular', { ascending: true })
      .order('numero', { ascending: true });
    if (alt.error) throw alt.error;
    entradas = (alt.data || []).map((r) => ({ ...r, sorteado: null }));
  }
  const lista = entradas || [];
  const dnis = Array.from(new Set(lista.map((r) => String(r.dni_titular || '')).filter(Boolean)));

  // 2) Nombres de invitados por DNI
  let nombresMap = new Map();
  if (dnis.length) {
    const { data: invitados, error: errInv } = await supabase
      .from('invitados')
      .select('dni, nombre')
      .in('dni', dnis);
    if (errInv) throw errInv;
    nombresMap = new Map((invitados || []).map((i) => [String(i.dni || ''), i.nombre || '']));
  }

  // 3) Armar filas agregadas por DNI (solo números sorteados)
  const map = new Map();
  lista.forEach((r) => {
    const dni = String(r.dni_titular || '');
    if (!dni) return;
    const nombre = nombresMap.get(dni) || '';
    const item = map.get(dni) || { dni, nombre, numeros: [] };
    item.numeros.push(r.numero);
    map.set(dni, item);
  });
  return Array.from(map.values());
}

function applyFilter(rows, q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) =>
    String(r.dni || '').toLowerCase().includes(s) ||
    String(r.nombre || '').toLowerCase().includes(s)
  );
}

function renderRows(rows) {
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.className = 'odd:bg-white even:bg-crema/30';
    const pulStr = (r.numeros || []).map((n) => `#${n}`).join(', ');
    tr.innerHTML = `
      <td class="p-3 whitespace-nowrap text-azuloscuro">${r.dni}</td>
      <td class="p-3 text-azuloscuro">${r.nombre}</td>
      <td class="p-3 text-azuloscuro">${pulStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

function toCSV(rows) {
  const header = ['dni','nombre','pulseras'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const pulStr = (r.numeros || []).map((n) => `#${n}`).join(' ');
    lines.push([r.dni, r.nombre, pulStr].map(esc).join(','));
  });
  return lines.join('\n');
}

$('#anio').textContent = new Date().getFullYear();

(async () => {
  await ensureAccess();
  try {
    let rows = await loadRows();
    const renderAll = () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      renderRows(filtered);
    };
    searchInput.addEventListener('input', renderAll);
    btnExportCsv.addEventListener('click', () => {
      const filtered = applyFilter(rows, searchInput.value || '');
      const csv = toCSV(filtered);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulseras_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
    renderAll();
  } catch (err) {
    console.error(err);
    await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar las pulseras.' });
  }
})();
