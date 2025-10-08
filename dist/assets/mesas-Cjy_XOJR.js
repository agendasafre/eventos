import{u as o,s as m}from"./ui-O1v2Q3bI.js";const h=(e,t=document)=>t.querySelector(e),f=h("#mesasContainer");h("#anio").textContent=new Date().getFullYear();const g=new URLSearchParams(window.location.search).get("token");if(!g)throw o.error("No se encontró el token de acceso."),new Error("Token faltante");o.loading("Cargando mesas...");let n=null,x=[],u=[];async function b(){try{const{data:e,error:t}=await m.from("invitados").select("*").eq("mesa_token",g).maybeSingle();if(t||!e)throw new Error("Token inválido");n=e;const{data:r,error:c}=await m.from("mesas").select("id, numero, capacidad, mesa_asientos (id, posicion, invitado_id, invitados(nombre))").order("numero",{ascending:!0});if(c)throw c;x=r||[],o.close(),v(),$()}catch(e){o.close(),console.error(e),o.error("Error al cargar las mesas.")}}function w(){return(n.opciones_comun||0)+(n.opciones_celiacos||0)+(n.opciones_vegetarianos||0)+(n.opciones_veganos||0)}function v(){const e=w(),t=u.length,r=e-t;let c=`
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
  `;h("#estadoAsientos")?.remove();const l=document.createElement("div");l.id="estadoAsientos",l.innerHTML=c,f.before(l)}function $(){f.innerHTML="",x.forEach(e=>{const t=document.createElement("div");t.className="bg-white/90 rounded-2xl shadow-md p-5 flex flex-col items-center text-center transition-transform hover:scale-105 m-2",t.innerHTML=`
      <h2 class="text-azuloscuro font-bold mb-4">Mesa ${e.numero}</h2>
      <div class="grid grid-cols-4 gap-3">
        ${E(e)}
      </div>
    `,f.appendChild(t)})}function E(e){const t=e.mesa_asientos||[],r=e.capacidad||8;return Array.from({length:r},(s,a)=>a+1).map(s=>t.find(i=>i.posicion===s)||{posicion:s,invitado_id:null,invitados:null}).map(s=>{const a=s.invitado_id&&s.invitado_id!==n.id,i=s.invitado_id===n.id;let d=a?"bg-rojo text-white cursor-not-allowed":i?"border-4 border-yellow-400":"border border-celeste hover:border-azuloscuro hover:bg-celeste/20",p=a?'<i class="fa-solid fa-user-slash"></i>':i?'<i class="fa-solid fa-star"></i>':'<i class="fa-solid fa-chair"></i>';const _=a?s.invitados?.nombre||"Ocupado":i?"Tu asiento":"Disponible",y=a||i?`<p class="text-sm text-gray-800 mt-1 text-center max-w-[120px] leading-tight">${i?"Vos":s.invitados?.nombre||"—"}</p>`:'<p class="text-sm text-transparent mt-1 max-w-[120px] leading-tight">.</p>';return`
        <div class="flex flex-col items-center justify-center text-center">
          <button
            data-mesa="${e.id}"
            data-pos="${s.posicion}"
            class="asiento w-12 h-12 rounded-full flex items-center justify-center ${d} transition"
            title="${_}"
            ${a?"disabled":""}
          >
            ${p}
          </button>
          ${y}
        </div>
      `}).join("")}f.addEventListener("click",async e=>{const t=e.target.closest(".asiento");if(!t||t.disabled)return;const r=parseInt(t.dataset.mesa,10),c=parseInt(t.dataset.pos,10),l=w(),{data:s,error:a}=await m.from("mesa_asientos").select("*").eq("mesa_id",r).eq("posicion",c).maybeSingle();if(a){console.error(a),o.error("No se pudo verificar el estado del asiento.");return}if(s?.invitado_id===n.id){const i=s.cambios||0;if(i>=2){o.info("Ya no podés cambiar este asiento más de 2 veces.");return}o.loading("Liberando asiento...");try{const{error:d}=await m.from("mesa_asientos").update({invitado_id:null,cambios:i+1}).eq("id",s.id);if(d)throw d;u=u.filter(p=>!(p.mesa_id===r&&p.posicion===c)),o.close(),o.success("Asiento liberado correctamente."),v(),await b()}catch(d){o.close(),console.error(d),o.error("Error al liberar el asiento.")}return}if(s?.invitado_id&&s.invitado_id!==n.id){o.info("Ese asiento ya está ocupado.");return}if(u.length>=l){o.info("Ya seleccionaste todos tus asientos disponibles.");return}o.loading("Guardando tu selección...");try{let i;s?i=m.from("mesa_asientos").update({invitado_id:n.id}).eq("id",s.id):i=m.from("mesa_asientos").insert([{mesa_id:r,posicion:c,invitado_id:n.id}]);const{error:d}=await i;if(d)throw d;u.push({mesa_id:r,posicion:c}),o.close(),o.success("Asiento seleccionado correctamente."),v(),await b()}catch(i){o.close(),console.error(i),o.error("No se pudo guardar tu selección.")}});b();
