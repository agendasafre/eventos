import { supabase } from '../lib/supabase.js';
import Swal from 'sweetalert2';

// Protección simple por clave
const ACCESS_KEY = import.meta.env.VITE_INTERNAL_KEY; // definida en .env
const storedKey = sessionStorage.getItem('internal_key');

async function pedirClave() {
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
  } else {
    await Swal.fire({
      icon: 'error',
      title: 'Clave incorrecta',
      text: 'No tenés autorización para acceder.',
      confirmButtonColor: '#457b9d',
    });
    return pedirClave();
  }
}

if (storedKey !== ACCESS_KEY) {
  await pedirClave();
}

document.body.classList.add('sorteo');

const slotText = document.getElementById('slotText');
const btnStart = document.getElementById('btnStart');
const winnerEl = document.getElementById('winner');
const winnerName = document.getElementById('winnerName');
const btnNext = document.getElementById('btnNext');
const confettiEl = document.getElementById('confetti');

// 🔊 Sonidos
import drumrollFile from '../assets/sounds/drumroll.mp3';
import fanfareFile from '../assets/sounds/fanfare.mp3';
const drumroll = new Audio(drumrollFile);
const fanfare = new Audio(fanfareFile);
drumroll.volume = 0.6;
fanfare.volume = 0.8;

const DURATION_MS = 4500;
const TICK_MIN_MS = 45;
const TICK_MAX_MS = 120;

let running = false;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
const easeOutQuad = (t) => t * (2 - t);

function setSlotDisplay(entrada) {
  slotText.textContent = `Nº ${entrada.numero}`;
}

function showWinner(entrada) {
  winnerName.textContent = `Nº ${entrada.numero}`;
  winnerEl.classList.add('show');
  fireConfetti();
}

function hideWinner() {
  winnerEl.classList.remove('show');
  clearConfetti();
}

function fireConfetti() {
  clearConfetti();
  const colors = ['#fff176', '#a5d6a7', '#81d4fa', '#f48fb1', '#ffd54f', '#b39ddb'];
  const total = 400; // 🎉 antes eran 100 → ahora 4x más confeti
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    d.style.left = Math.random() * 100 + 'vw';
    d.style.background = colors[Math.floor(Math.random() * colors.length)];
    d.style.animationDuration = 3 + Math.random() * 4 + 's';
    d.style.width = d.style.height = 6 + Math.random() * 6 + 'px';
    d.style.opacity = 0.8 + Math.random() * 0.2;
    confettiEl.appendChild(d);
  }
}


function clearConfetti() {
  confettiEl.innerHTML = '';
}

async function startSorteo() {
  if (running) return;
  running = true;
  btnStart.disabled = true;
  hideWinner();

  const { data, error } = await supabase
    .from('entradas')
    .select('numero')
    .eq('entregado', true)
    .eq('sorteado', false)
    .order('numero', { ascending: true });

  if (error || !data?.length) {
    running = false;
    btnStart.disabled = false;
    return Swal.fire('Sin elegibles', 'No quedan números disponibles.', 'info');
  }

  const participantes = data.sort(() => Math.random() - 0.5);
  const ganador = participantes[Math.floor(Math.random() * participantes.length)];

  // 🎶 Comienza el redoblante
  drumroll.currentTime = 0;
  drumroll.play();

  const start = performance.now();
  let lastIdx = 0;
  while (true) {
    const now = performance.now();
    const t = Math.min(1, (now - start) / DURATION_MS);
    const speed = TICK_MAX_MS - (TICK_MAX_MS - TICK_MIN_MS) * easeOutQuad(t);
    const idx = Math.floor(now / speed) % 10;
    if (idx !== lastIdx) {
      slotText.textContent = `Nº ${Math.floor(Math.random() * 999)}`;
      lastIdx = idx;
    }
    if (t >= 1) break;
    await sleep(16);
  }

  // 🔇 Parar redoblante, mostrar ganador
  drumroll.pause();
  drumroll.currentTime = 0;

  setSlotDisplay(ganador);
  showWinner(ganador);

  // 🎺 Fanfarria triunfal
  fanfare.currentTime = 0;
  fanfare.play();

  await supabase.from('entradas').update({ sorteado: true }).eq('numero', ganador.numero);

  btnNext.disabled = false;
  running = false;
}


async function nextRound() {
  btnNext.disabled = true;
  hideWinner();
  slotText.textContent = 'Listo para sortear…';
  await sleep(500);
  startSorteo();
}

btnStart.addEventListener('click', startSorteo);
btnNext.addEventListener('click', nextRound);
