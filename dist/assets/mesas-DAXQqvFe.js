import{u as o,s as m}from"./ui-DfcM_wMX.js";const b=(e,t=document)=>t.querySelector(e),u=b("#mesasContainer");b("#anio").textContent=new Date().getFullYear();const v=new URLSearchParams(window.location.search).get("token");if(!v)throw o.error("No se encontró el token de acceso."),new Error("Token faltante");o.loading("Cargando mesas...");let n=null,h=[],p=[];async function f(){try{const{data:e,error:t}=await m.from("invitados").select("*").eq("mesa_token",v).maybeSingle();if(t||!e)throw new Error("Token inválido");n=e;const{data:r,error:c}=await m.from("mesas").select("id, numero, capacidad, mesa_asientos (id, posicion, invitado_id, invitados(nombre))").order("numero",{ascending:!0});if(c)throw c;h=r||[],o.close(),y(),$()}catch(e){o.close(),console.error(e),o.error("Error al cargar las mesas.")}}function g(){return(n.opciones_comun||0)+(n.opciones_celiacos||0)+(n.opciones_vegetarianos||0)+(n.opciones_veganos||0)}function y(){const e=g(),t=p.length,r=e-t;let c=`
    <div class="mb-6 text-center bg-white/90 p-4 rounded-xl shadow">
      <p class="text-azuloscuro font-semibold">
        Tenés <b>${e}</b> asiento${e>1?"s":""} disponible${e>1?"s":""}.
      </p>
      <p class="text-sm text-gray-600">
        Seleccionaste ${t}, te quedan ${r}.
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Podés cambiar cada asiento hasta <b>2 veces</b>.
      </p>
    </div>
  `;b("#estadoAsientos")?.remove();const l=document.createElement("div");l.id="estadoAsientos",l.innerHTML=c,u.before(l)}function $(){u.innerHTML="",h.forEach(e=>{const t=document.createElement("div");t.className="bg-white/90 rounded-2xl shadow-md p-5 flex flex-col items-center text-center transition-transform hover:scale-105 m-2",t.innerHTML=`
      <h2 class="text-azuloscuro font-bold mb-4">Mesa ${e.numero}</h2>
      <div class="grid grid-cols-4 gap-3">
        ${E(e)}
      </div>
    `,u.appendChild(t)})}function E(e){const t=e.mesa_asientos||[],r=e.capacidad||8;return Array.from({length:r},(s,i)=>i+1).map(s=>t.find(a=>a.posicion===s)||{posicion:s,invitado_id:null,invitados:null}).map(s=>{const i=s.invitado_id&&s.invitado_id!==n.id,a=s.invitado_id===n.id;let d=i?"bg-rojo text-white cursor-not-allowed":a?"border-4 border-yellow-400":"border border-celeste hover:border-azuloscuro hover:bg-celeste/20",x=i?'<i class="fa-solid fa-user-slash"></i>':a?'<i class="fa-solid fa-star"></i>':'<i class="fa-solid fa-chair"></i>';const w=i?s.invitados?.nombre||"Ocupado":a?"Tu asiento":"Disponible",_=i||a?`<p class="text-sm text-gray-800 mt-1 text-center max-w-[120px] leading-tight">${a?"Vos":s.invitados?.nombre||"—"}</p>`:'<p class="text-sm text-transparent mt-1 max-w-[120px] leading-tight">.</p>';return`
        <div class="flex flex-col items-center justify-center text-center">
          <button
            data-mesa="${e.id}"
            data-pos="${s.posicion}"
            class="asiento w-12 h-12 rounded-full flex items-center justify-center ${d} transition"
            title="${w}"
            ${i?"disabled":""}
          >
            ${x}
          </button>
          ${_}
        </div>
      `}).join("")}u.addEventListener("click",async e=>{const t=e.target.closest(".asiento");if(!t||t.disabled)return;const r=parseInt(t.dataset.mesa,10),c=parseInt(t.dataset.pos,10),l=g(),{data:s,error:i}=await m.from("mesa_asientos").select("*").eq("mesa_id",r).eq("posicion",c).maybeSingle();if(i){console.error(i),o.error("No se pudo verificar el estado del asiento.");return}if(s?.invitado_id===n.id){const a=s.cambios||0;if(a>=2){o.info("Ya no podés cambiar este asiento más de 2 veces.");return}o.loading("Liberando asiento...");try{const{error:d}=await m.from("mesa_asientos").update({invitado_id:null,cambios:a+1}).eq("id",s.id);if(d)throw d;o.close(),o.success("Asiento liberado correctamente."),await f()}catch(d){o.close(),console.error(d),o.error("Error al liberar el asiento.")}return}if(s?.invitado_id&&s.invitado_id!==n.id){o.info("Ese asiento ya está ocupado.");return}if(p.length>=l){o.info("Ya seleccionaste todos tus asientos disponibles.");return}o.loading("Guardando tu selección...");try{let a;s?a=m.from("mesa_asientos").update({invitado_id:n.id}).eq("id",s.id):a=m.from("mesa_asientos").insert([{mesa_id:r,posicion:c,invitado_id:n.id}]);const{error:d}=await a;if(d)throw d;p.push({mesa_id:r,posicion:c}),o.close(),o.success("Asiento seleccionado correctamente."),await f()}catch(a){o.close(),console.error(a),o.error("No se pudo guardar tu selección.")}});f();
