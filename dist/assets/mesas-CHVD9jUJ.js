import{u as s,s as l}from"./ui-CFsL810y.js";const g=(e,o=document)=>o.querySelector(e),f=g("#mesasContainer");g("#anio").textContent=new Date().getFullYear();const _=new URLSearchParams(window.location.search).get("token");if(!_)throw s.error("No se encontró el token de acceso."),new Error("Token faltante");s.loading("Cargando mesas...");let n=null,h=[],p=[],d=null;function x(){return(n.opciones_comun||0)+(n.opciones_celiacos||0)+(n.opciones_vegetarianos||0)+(n.opciones_veganos||0)}function w(){p=[];for(const e of h){const o=e.mesa_asientos||[];for(const a of o)a?.invitado_id===n.id&&p.push({mesa_id:e.id,posicion:a.posicion,id:a.id,cambios:a.cambios||0})}}function b(){const e=x(),o=p.length,a=e-o;let r=`
    <div class="mb-6 text-center bg-white/90 p-4 rounded-xl shadow">
      <p class="text-azuloscuro font-semibold">
        Tenés <b>${e}</b> asiento${e>1?"s":""} disponible${e>1?"s":""}.
      </p>
      <p class="text-sm text-gray-600">
        Seleccionaste ${o}, te quedan ${a}.
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Podés cambiar cada asiento hasta <b>2 veces</b>.
      </p>
    </div>
  `;g("#estadoAsientos")?.remove();const m=document.createElement("div");m.id="estadoAsientos",m.innerHTML=r,f.before(m)}async function v(){try{const{data:e,error:o}=await l.from("invitados").select("*").eq("mesa_token",_).maybeSingle();if(o||!e)throw new Error("Token inválido");n=e;const{data:a,error:r}=await l.from("mesas").select(`
        id,
        numero,
        capacidad,
        mesa_asientos (
          id,
          posicion,
          invitado_id,
          cambios,
          invitados ( nombre )
        )
      `).order("numero",{ascending:!0});if(r)throw r;h=a||[],w(),s.close(),b(),q()}catch(e){s.close(),console.error(e),s.error("Error al cargar las mesas.")}}function q(){f.innerHTML="",h.forEach(e=>{const o=document.createElement("div");o.className="bg-white/90 rounded-2xl shadow-md p-5 flex flex-col items-center text-center transition-transform hover:scale-105",o.innerHTML=`
      <h2 class="text-azuloscuro font-bold mb-4">Mesa ${e.numero}</h2>
      <div class="grid grid-cols-4 gap-3">
        ${M(e)}
      </div>
    `,f.appendChild(o)})}function M(e){const o=e.mesa_asientos||[],a=e.capacidad||8;return Array.from({length:a},(i,c)=>c+1).map(i=>o.find(t=>t.posicion===i)||{posicion:i,invitado_id:null,invitados:null}).map(i=>{const c=i.invitado_id&&i.invitado_id!==n.id,t=i.invitado_id===n.id;let u=c?"bg-rojo text-white cursor-not-allowed":t?"border-4 border-yellow-400":"border border-celeste hover:border-azuloscuro hover:bg-celeste/20",y=c?'<i class="fa-solid fa-user-slash"></i>':t?'<i class="fa-solid fa-star"></i>':'<i class="fa-solid fa-chair"></i>';const E=c?i.invitados?.nombre||"Ocupado":t?"Tu asiento":"Disponible",$=c||t?`<p class="text-sm text-gray-800 mt-1 text-center max-w-[120px] leading-tight">${t?"Vos":i.invitados?.nombre||"—"}</p>`:'<p class="text-sm text-transparent mt-1 max-w-[120px] leading-tight">.</p>';return`
        <div class="flex flex-col items-center justify-center text-center">
          <button
            data-mesa="${e.id}"
            data-pos="${i.posicion}"
            class="asiento w-12 h-12 rounded-full flex items-center justify-center ${u} transition"
            title="${E}"
            ${c?"disabled":""}
          >
            ${y}
          </button>
          ${$}
        </div>
      `}).join("")}f.addEventListener("click",async e=>{const o=e.target.closest(".asiento");if(!o||o.disabled)return;const a=parseInt(o.dataset.mesa,10),r=parseInt(o.dataset.pos,10),m=x(),{data:i,error:c}=await l.from("mesa_asientos").select("*").eq("mesa_id",a).eq("posicion",r).maybeSingle();if(c){console.error(c),s.error("No se pudo verificar el estado del asiento.");return}if(i?.invitado_id===n.id){const t=i.cambios||0;if(t>=2){s.info("Ya no podés cambiar este asiento más de 2 veces.");return}s.loading("Liberando asiento...");try{await l.from("mesa_asientos").update({invitado_id:null}).eq("id",i.id),d={id:i.id,cambios:t},p=p.filter(u=>!(u.mesa_id===a&&u.posicion===r)),s.close(),s.success("Asiento liberado. Elegí un nuevo lugar."),b(),await v()}catch(u){s.close(),console.error(u),s.error("Error al liberar el asiento.")}return}if(i?.invitado_id&&i.invitado_id!==n.id){s.info("Ese asiento ya está ocupado.");return}if(!d&&p.length>=m){s.info("Ya seleccionaste todos tus asientos disponibles.");return}s.loading(d?"Cambiando de asiento...":"Guardando tu selección...");try{if(await l.from("mesa_asientos").delete().eq("mesa_id",a).eq("posicion",r).is("invitado_id",null),d){const{error:t}=await l.from("mesa_asientos").update({mesa_id:a,posicion:r,invitado_id:n.id,cambios:d.cambios+1}).eq("id",d.id);if(t)throw t;d=null}else{const{error:t}=await l.from("mesa_asientos").insert([{mesa_id:a,posicion:r,invitado_id:n.id,cambios:0}]);if(t)throw t}s.close(),s.success("Asiento guardado correctamente."),await v(),w(),b()}catch(t){s.close(),console.error(t),s.error("No se pudo guardar tu selección.")}});v();
