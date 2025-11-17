// Barra de navegación reutilizable (uniforme en todas las vistas)
// Cómo incluirla en cada HTML:
// <div id="appNav"></div>
// <script type="module" src="/src/components/nav.js"></script>

const mountPoint = document.getElementById('appNav');
if (mountPoint) {
  const links = [
    { href: '/index.html', label: 'Inicio' },
    { href: '/retiro.html', label: 'Retiro' },
    { href: '/devolver.html', label: 'Devolver' },
    { href: '/retirados.html', label: 'Retiraron' },
    { href: '/pendientes.html', label: 'Pendientes de retiro' },
    { href: '/manual.html', label: 'Pasantes/Contratados' },
    { href: '/quien.html', label: 'Registrados' },
  ];

  const path = window.location.pathname.replace(/\/index\.html$/, '/');
  const isActive = (href) => {
    if (href === '/index.html' && (path === '/' || path.endsWith('/index.html'))) return true;
    return path.endsWith(href);
  };

  const nav = document.createElement('nav');
  // w-full para evitar problemas dentro de contenedores flex (p. ej., páginas centradas)
  nav.className = 'w-full sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm mb-4 md:mb-6';
  nav.innerHTML = `
    <div class="mx-auto max-w-6xl px-3">
      <div class="flex h-14 items-center justify-between gap-3">
        <a href="/index.html" class="flex items-center gap-2 shrink-0" aria-label="Inicio">
          <img src="/src/assets/logo.webp" alt="UNSJ" class="h-7 w-7 rounded-sm" />
          <span class="hidden sm:block font-semibold tracking-tight text-azuloscuro">Cena UNSJ</span>
        </a>
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar">
          ${links
            .map((l) => {
              const active = isActive(l.href);
              const base = 'whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-colors';
              const cls = active
                ? 'bg-azuloscuro text-white shadow'
                : 'text-azuloscuro hover:bg-celeste/30';
              const aria = active ? 'aria-current="page"' : '';
              return `<a href="${l.href}" ${aria} class="${base} ${cls}">${l.label}</a>`;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;

  mountPoint.replaceWith(nav);
}
