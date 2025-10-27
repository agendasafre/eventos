import{S as p}from"./sweetalert2.esm.all-DP5jmEj0.js";import{s as _}from"./supabase-CFADINa5.js";const u="555255",v=sessionStorage.getItem("internal_key"),i=(e,t=document)=>t.querySelector(e),g=i("#tbody"),w=i("#totales"),d=i("#search"),h=i("#btnExport");function s(e){const t=parseInt(e,10);return Number.isNaN(t)?0:t}function f(e){return s(e.opciones_comun)+s(e.opciones_celiacos)+s(e.opciones_vegetarianos)+s(e.opciones_veganos)}function $(e){g.innerHTML="",e.forEach(t=>{const o=document.createElement("tr");o.className="odd:bg-white even:bg-crema/30",o.innerHTML=`
      <td class="p-3 whitespace-nowrap">${t.dni||""}</td>
      <td class="p-3">${t.nombre||""}</td>
      <td class="p-3">${t.correo||""}</td>
      <td class="p-3">${t.lugar_trabajo||""}</td>
      <td class="p-3 text-right">${s(t.opciones_comun)}</td>
      <td class="p-3 text-right">${s(t.opciones_celiacos)}</td>
      <td class="p-3 text-right">${s(t.opciones_vegetarianos)}</td>
      <td class="p-3 text-right">${s(t.opciones_veganos)}</td>
      <td class="p-3 text-right font-semibold">${f(t)}</td>
    `,g.appendChild(o)})}function C(e){const t=e.reduce((c,a)=>c+s(a.opciones_comun),0),o=e.reduce((c,a)=>c+s(a.opciones_celiacos),0),n=e.reduce((c,a)=>c+s(a.opciones_vegetarianos),0),r=e.reduce((c,a)=>c+s(a.opciones_veganos),0),l=t+o+n+r;w.innerHTML=`
    <div class="flex flex-wrap gap-3 items-center">
      <span>Total Común: <b>${t}</b></span>
      <span>· Celíacos: <b>${o}</b></span>
      <span>· Vegetarianos: <b>${n}</b></span>
      <span>· Veganos: <b>${r}</b></span>
      <span class="ml-auto">Total general: <b>${l}</b></span>
    </div>
  `}function S(e){const o=[["dni","nombre","correo","lugar_trabajo","opciones_comun","opciones_celiacos","opciones_vegetarianos","opciones_veganos","total"].join(",")];return e.forEach(n=>{const r=[n.dni||"",n.nombre||"",n.correo||"",n.lugar_trabajo||"",s(n.opciones_comun),s(n.opciones_celiacos),s(n.opciones_vegetarianos),s(n.opciones_veganos),f(n)],l=c=>{const a=String(c).replaceAll('"','""');return/[",\n]/.test(a)?`"${a}"`:a};o.push(r.map(l).join(","))}),o.join(`
`)}function x(e,t){const o=new Blob([t],{type:"text/csv;charset=utf-8;"}),n=URL.createObjectURL(o),r=document.createElement("a");r.href=n,r.download=e,r.click(),URL.revokeObjectURL(n)}function b(e,t){const o=t.trim().toLowerCase();return o?e.filter(n=>String(n.dni||"").toLowerCase().includes(o)||String(n.nombre||"").toLowerCase().includes(o)||String(n.correo||"").toLowerCase().includes(o)):e}async function L(){const{data:e,error:t}=await _.from("invitados").select("dni, nombre, correo, lugar_trabajo, estado, retiro, opciones, opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos").eq("estado","registrado").or("retiro.is.false,retiro.is.null").gt("opciones",0).order("dni",{ascending:!0});if(t)throw t;return e||[]}async function m(){if(v===u)return!0;const{value:e}=await p.fire({title:"Acceso restringido",input:"password",inputLabel:"Ingresá la clave de acceso",inputPlaceholder:"••••••",confirmButtonText:"Entrar",background:"#f1faee",color:"#1d3557",allowOutsideClick:!1});return e===u?(sessionStorage.setItem("internal_key",e),!0):(await p.fire({icon:"error",title:"Clave incorrecta",text:"No tenés autorización para acceder."}),m())}async function E(){i("#anio").textContent=new Date().getFullYear(),await m();try{let e=await L();const t=()=>{const o=b(e,d.value||"");$(o),C(o)};d.addEventListener("input",t),h.addEventListener("click",()=>{const o=b(e,d.value||""),n=S(o);x(`pendientes_retiro_${new Date().toISOString().slice(0,10)}.csv`,n)}),t()}catch(e){console.error(e),await p.fire({icon:"error",title:"Error",text:"No se pudieron cargar los datos."})}}E();
