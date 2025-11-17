const r=document.getElementById("appNav");if(r){const l=[{href:"/index.html",label:"Inicio"},{href:"/retiro.html",label:"Retiro"},{href:"/devolver.html",label:"Devolver"},{href:"/retirados.html",label:"Retiraron"},{href:"/pendientes.html",label:"Pendientes de retiro"},{href:"/manual.html",label:"Pasantes/Contratados"},{href:"/quien.html",label:"Registrados"}],t=window.location.pathname.replace(/\/index\.html$/,"/"),n=e=>e==="/index.html"&&(t==="/"||t.endsWith("/index.html"))?!0:t.endsWith(e),a=document.createElement("nav");a.className="w-full sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm mb-4 md:mb-6",a.innerHTML=`
    <div class="mx-auto max-w-6xl px-3">
      <div class="flex h-14 items-center justify-between gap-3">
        <a href="/index.html" class="flex items-center gap-2 shrink-0" aria-label="Inicio">
          <img src="/src/assets/logo.webp" alt="UNSJ" class="h-7 w-7 rounded-sm" />
          <span class="hidden sm:block font-semibold tracking-tight text-azuloscuro">Cena UNSJ</span>
        </a>
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar">
          ${l.map(e=>{const s=n(e.href),o="whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-colors",i=s?"bg-azuloscuro text-white shadow":"text-azuloscuro hover:bg-celeste/30",c=s?'aria-current="page"':"";return`<a href="${e.href}" ${c} class="${o} ${i}">${e.label}</a>`}).join("")}
        </div>
      </div>
    </div>
  `,r.replaceWith(a)}
