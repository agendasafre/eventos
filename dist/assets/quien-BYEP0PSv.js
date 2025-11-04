import{S as p}from"./sweetalert2.esm.all-D00jIjAz.js";import"./nav-BTX2NAH9.js";import{s as b}from"./supabase-CFADINa5.js";const d="555255",f=sessionStorage.getItem("internal_key"),i=(e,t=document)=>t.querySelector(e),m=i("#tbody"),v=i("#totales"),u=i("#search"),x=i("#btnExport");function a(e){const t=parseInt(e,10);return Number.isNaN(t)?0:t}function w(e){m.innerHTML="",e.forEach(t=>{const n=document.createElement("tr");n.className="odd:bg-white even:bg-crema/30",n.innerHTML=`
      <td class="p-3 whitespace-nowrap text-center text-azuloscuro">${t.dni||""}</td>
      <td class="p-3 text-azuloscuro">${t.nombre||""}</td>
      <td class="p-3 text-center text-azuloscuro">${t.lugar_trabajo||""}</td>
      <td class="p-3 text-center text-azuloscuro">${a(t.opciones_comun)}</td>
      <td class="p-3 text-center text-azuloscuro">${a(t.opciones_celiacos)}</td>
      <td class="p-3 text-center text-azuloscuro">${a(t.opciones_vegetarianos)}</td>
      <td class="p-3 text-center text-azuloscuro">${a(t.opciones_veganos)}</td>
      <td class="p-3 text-center text-azuloscuro font-semibold">${a(t.opciones)}</td>
      <td class="p-3 text-center text-azuloscuro">${t.es_manual?"No":"Si"}</td>
    `,m.appendChild(n)})}function $(e){const t=e.reduce((c,s)=>c+a(s.opciones_comun),0),n=e.reduce((c,s)=>c+a(s.opciones_celiacos),0),o=e.reduce((c,s)=>c+a(s.opciones_vegetarianos),0),r=e.reduce((c,s)=>c+a(s.opciones_veganos),0),l=e.reduce((c,s)=>c+a(s.opciones),0);v.innerHTML=`
    <div class="flex flex-wrap gap-3 items-center">
      <span>Total Comun: <b>${t}</b></span>
      <span>· Celíacos: <b>${n}</b></span>
      <span>· Vegetarianos: <b>${o}</b></span>
      <span>· Veganos: <b>${r}</b></span>
      <span class="ml-auto">Total general: <b>${l}</b></span>
    </div>
  `}function S(e){const n=[["dni","nombre","lugar_trabajo","opciones_comun","opciones_celiacos","opciones_vegetarianos","opciones_veganos","opciones_total","importe_total","cuotas","importe_cuota","por_planilla"].join(",")];return e.forEach(o=>{const r=[o.dni||"",o.nombre||"",o.lugar_trabajo||"",a(o.opciones_comun),a(o.opciones_celiacos),a(o.opciones_vegetarianos),a(o.opciones_veganos),a(o.opciones),o.es_manual?a(o.opciones*25e3):a(o.opciones*5e4),o.es_manual?3:4,o.es_manual?a(o.opciones*25e3/3):a(o.opciones*5e4/4),o.es_manual?"No":"Si"],l=c=>{const s=String(c).replaceAll('"','""');return/[",\n]/.test(s)?`"${s}"`:s};n.push(r.map(l).join(","))}),n.join(`
`)}function h(e,t){const n=new Blob([t],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(n),r=document.createElement("a");r.href=o,r.download=e,r.click(),URL.revokeObjectURL(o)}function _(e,t){const n=t.trim().toLowerCase();return n?e.filter(o=>String(o.dni||"").toLowerCase().includes(n)||String(o.nombre||"").toLowerCase().includes(n)||String(o.correo||"").toLowerCase().includes(n)):e}async function C(){const{data:e,error:t}=await b.from("invitados").select("dni, nombre, lugar_trabajo, opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos, acepto_terminos, opciones, es_manual").eq("acepto_terminos",!0).order("dni",{ascending:!0});if(t)throw t;return e||[]}async function g(){if(f===d)return!0;const{value:e}=await p.fire({title:"Acceso restringido",input:"password",inputLabel:"Ingresá la clave de acceso",inputPlaceholder:"••••••",confirmButtonText:"Entrar",background:"#f1faee",color:"#1d3557",allowOutsideClick:!1});return e===d?(sessionStorage.setItem("internal_key",e),!0):(await p.fire({icon:"error",title:"Clave incorrecta",text:"No tenés autorización para acceder."}),g())}async function L(){i("#anio").textContent=new Date().getFullYear(),await g();try{let e=await C();const t=()=>{const n=_(e,u.value||"");w(n),$(n)};u.addEventListener("input",t),x.addEventListener("click",()=>{const n=_(e,u.value||""),o=S(n);h(`invitados_aceptados_${new Date().toISOString().slice(0,10)}.csv`,o)}),t()}catch(e){console.error(e),await p.fire({icon:"error",title:"Error",text:"No se pudieron cargar los datos."})}}L();
