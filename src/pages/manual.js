import { ui } from '../ui.js';

const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY;
const ENDPOINT = import.meta.env.DEV
  ? 'https://cena-unsj.vercel.app/api/manual'
  : '/api/manual';

const $ = (s, p = document) => p.querySelector(s);

async function pedirClave() {
  const { value: clave } = await Swal.fire({
    title: 'Acceso restringido',
    input: 'password',
    inputLabel: 'Ingresá la clave interna',
    inputPlaceholder: '••••••',
    confirmButtonText: 'Entrar',
    background: '#f1faee',
    color: '#1d3557',
    allowOutsideClick: false,
  });
  if (clave === ACCESS_KEY) {
    sessionStorage.setItem('internal_key', clave);
    return true;
  } else {
    await Swal.fire({
      icon: 'error',
      title: 'Clave incorrecta',
      confirmButtonColor: '#457b9d',
    });
    return pedirClave();
  }
}

const storedKey = sessionStorage.getItem('internal_key');
if (storedKey !== ACCESS_KEY) {
  await pedirClave();
}

const dni = $('#dni');
const nombre = $('#nombre');
const correo = $('#correo');
const lugar = $('#lugar');
const comun = $('#comun');
const celiacos = $('#celiacos');
const vegetarianos = $('#vegetarianos');
const veganos = $('#veganos');
const totalNum = $('#totalNum');
const form = $('#form');
const limpiarBtn = $('#limpiarBtn');
const resultado = $('#resultado');

const int = (v) => (Number.isNaN(parseInt(v, 10)) ? 0 : parseInt(v, 10));

function actualizarTotal() {
  const total = int(comun.value) + int(celiacos.value) + int(vegetarianos.value) + int(veganos.value);
  totalNum.textContent = total;
  return total;
}

[comun, celiacos, vegetarianos, veganos].forEach((el) => el.addEventListener('input', actualizarTotal));
actualizarTotal();

limpiarBtn.addEventListener('click', () => {
  form.reset();
  actualizarTotal();
  resultado.classList.add('hidden');
  resultado.textContent = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const total = actualizarTotal();
  if (!nombre.value.trim() || !correo.value.trim()) {
    return ui.info('Completá nombre y correo');
  }
  if (total < 1) return ui.info('Seleccioná al menos un menú');

  const payload = {
    dni: dni.value.trim() || null,
    nombre: nombre.value.trim(),
    correo: correo.value.trim(),
    lugar: lugar.value.trim() || null,
    comun: int(comun.value),
    celiacos: int(celiacos.value),
    vegetarianos: int(vegetarianos.value),
    veganos: int(veganos.value),
    enviar_mail: true,
  };

  try {
    ui.loading('Guardando invitado...');
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': ACCESS_KEY || '',
      },
      body: JSON.stringify(payload),
    });

    const ct = resp.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');
    const raw = isJson ? await resp.text() : await resp.text();
    let data;
    try {
      data = isJson ? JSON.parse(raw || '{}') : {};
    } catch {
      data = {};
    }

    ui.close();
    if (!resp.ok) throw new Error(data?.error || raw || 'Error al guardar');

    const mesasUrl = `${location.origin}/mesas.html?token=${encodeURIComponent(data.mesa_token)}`;
    resultado.innerHTML = `
      <div>
        <p><b>${data.message || 'Invitado guardado'}</b></p>
        <p class="mt-1">Token de mesas: <code>${data.mesa_token || ''}</code></p>
        <p class="mt-1">Link de selección de mesas:</p>
        <p class="truncate"><a href="${mesasUrl}" class="text-azul underline" target="_blank">${mesasUrl}</a></p>
      </div>
    `;
    resultado.classList.remove('hidden');
    ui.success('Listo. Copiá el link para enviar.');
  } catch (err) {
    ui.close();
    console.error(err);
    ui.error(err.message || 'No se pudo guardar');
  }
});

$('#anio').textContent = new Date().getFullYear();
