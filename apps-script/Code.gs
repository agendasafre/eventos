
/****************************************
 * CONFIGURACIÓN GENERAL
 * Modificá los valores de este bloque.
 ****************************************/
const APP_URL = "https://unsj-cena.vercel.app/";
const PRECIO_UNITARIO = 80000;
const PRECIO_UNITARIO_MANUAL = 70000;
const CANTIDAD_CUOTAS = 4;
const ANIO_EVENTO = 2026;

const NOMBRE_EVENTO =
  `Cena de Fin de Año del Rectorado - UNSJ ${ANIO_EVENTO}`;

const TITULO_REGISTRO =
  `Confirmación de Registro en la Cena del Rectorado - UNSJ ${ANIO_EVENTO}`;

const LUGAR_RETIRO = "Dirección de Concursos Nodocente";
const PREFIJO_ASUNTO = "Cena Rectorado UNSJ";

const ASUNTOS = {
  registro: `${PREFIJO_ASUNTO} - Confirmación de registro`,
  retiro: `${PREFIJO_ASUNTO} - Retiro de entradas`,
  mesas: `${PREFIJO_ASUNTO} - Asiento/s Seleccionado/s`
};

const MENSAJES = {
  descuentoNormal:
    "Recordá que las cuotas serán descontadas por planilla de haberes.",
  descuentoManual:
    "Recordá que las cuotas serán descontadas del pago.",
  pie:
    "Este correo fue generado automáticamente. Por favor, no respondas a este mensaje.",
  fiesta:
    "&#x1F973; ¡Nos vemos en la fiesta! &#x1F973;"
};

/****************************************
 * ESTILOS COMPARTIDOS
 ****************************************/
const ESTILOS = {
  contenedor:
    "font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafc;border:1px solid #ddd;border-radius:12px;padding:20px;",
  titulo:
    "color:#1d3557;text-align:center;margin-top:0;",
  detalle:
    "background:#f1faee;padding:15px;border-radius:8px;margin:20px 0;",
  renglon:
    "font-size:16px;margin:5px 0;",
  separador:
    "margin:30px 0;border:none;border-top:1px solid #ccc;",
  pie:
    "font-size:13px;color:#777;text-align:center;",
  boton:
    "display:inline-block;background-color:#457b9d;color:#ffffff !important;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;font-family:Arial,sans-serif;transition:background-color 0.2s ease;"
};

/****************************************
 * FUNCIONES COMPARTIDAS
 ****************************************/

// Calcula importe total y valor de cada cuota.
function calcularPago(cantidad, esManual = false) {
  const precio = esManual
    ? PRECIO_UNITARIO_MANUAL
    : PRECIO_UNITARIO;

  const importeTotal = Number(cantidad) * precio;

  const valorCuota = Number(
    (importeTotal / CANTIDAD_CUOTAS).toFixed(2)
  );

  return { importeTotal, valorCuota };
}

// Devuelve el mensaje correspondiente al tipo de registro.
function mensajeDescuento(esManual = false) {
  const mensaje = esManual
    ? MENSAJES.descuentoManual
    : MENSAJES.descuentoNormal;

  return `<p style="text-align:center;">${mensaje}</p>`;
}

// Genera el detalle de los menús.
function detalleMenus({
  comun = 0,
  celiacos = 0,
  vegetarianos = 0,
  veganos = 0
}) {
  return `
    <p style="${ESTILOS.renglon}">
      <b>&#x1F356; Menú Común:</b> ${comun}
    </p>
    <p style="${ESTILOS.renglon}">
      <b>&#x1F6AB; Celíacos:</b> ${celiacos}
    </p>
    <p style="${ESTILOS.renglon}">
      <b>&#x1F955; Vegetarianos:</b> ${vegetarianos}
    </p>
    <p style="${ESTILOS.renglon}">
      <b>&#x1F966; Veganos:</b> ${veganos}
    </p>`;
}

// Pie compartido para todos los correos.
function pieCorreo() {
  return `
    <hr style="${ESTILOS.separador}" />
    <p style="${ESTILOS.pie}">
      ${MENSAJES.pie}
    </p>`;
}

// Genera el botón de gestión de asientos.
function enlaceMesas(token, margenSuperior = 20) {
  if (!token) return "";

  return `
    <p style="text-align:center;margin-top:${margenSuperior}px;">
      Podés elegir o cambiar tu/s asiento/s:<br/>
      <a href="${APP_URL.replace(/\/+$/, "")}/mesas?token=${encodeURIComponent(token)}"
         target="_blank"
         style="${ESTILOS.boton}">
        Gestionar asiento/s
      </a>
    </p>`;
}

// Centraliza el envío mediante GmailApp.
function enviarCorreo(correo, asunto, cuerpoHTML) {
  GmailApp.sendEmail(correo, asunto, "", {
    htmlBody: cuerpoHTML
  });

  return ContentService.createTextOutput("OK");
}

/****************************************
 * ROUTER
 * Mantiene los nombres originales.
 ****************************************/
function doPost(e) {
  let data = {};

  try {
    data = JSON.parse(e.postData.contents);
  } catch {
    data = e.parameter;
  }

  try {
    switch (data.action) {
      case "mail_registro":
        return mailRegistro(data);

      case "mail_registro_manual":
        return mailRegistroManual(data);

      case "mail_retiro":
        return mailRetiro(data);

      case "mail_mesas":
        return mailResumenMesas(data);

      default:
        return ContentService.createTextOutput(
          "Acción inválida"
        );
    }
  } catch (err) {
    console.error(err);

    return ContentService.createTextOutput(
      "❌ Error al enviar correo"
    );
  }
}

/****************************************
 * 1) CONFIRMACIÓN DE REGISTRO
 ****************************************/

// Registro normal.
function mailRegistro(data) {
  return enviarRegistro(data, false);
}

// Registro manual.
function mailRegistroManual(data) {
  return enviarRegistro(data, true);
}

// Función compartida para ambos tipos de registro.
function enviarRegistro({
  dni,
  nombre,
  correo,
  comun = 0,
  celiacos = 0,
  vegetarianos = 0,
  veganos = 0,
  total = 0,
  mesa_token = null
}, esManual) {

  if (!correo) {
    return ContentService.createTextOutput("Falta correo");
  }

  const { importeTotal, valorCuota } =
    calcularPago(total, esManual);

  const cuerpoHTML = `
  <div style="${ESTILOS.contenedor}">

    <h2 style="${ESTILOS.titulo}">
      ${TITULO_REGISTRO}
    </h2>

    <p>Hola <b>${nombre}</b>,</p>

    <p>
      Te confirmamos que te registraste correctamente para la
      <strong>${NOMBRE_EVENTO}</strong>.
    </p>

    <div style="${ESTILOS.detalle}">

      <p style="${ESTILOS.renglon}">
        <b>&#x1F4C4; DNI:</b> ${dni}
      </p>

      ${detalleMenus({
        comun,
        celiacos,
        vegetarianos,
        veganos
      })}

      <p style="${ESTILOS.renglon}">
        <b>
          &#x1F4B0; Total: $${importeTotal}
          en ${CANTIDAD_CUOTAS} cuotas
          de $${valorCuota}
        </b>
      </p>

    </div>

    ${mensajeDescuento(esManual)}

    ${esManual ? enlaceMesas(mesa_token) : ""}

    ${esManual ? "" : `
      <p style="font-size:18px;color:#333;text-align:center;">
        &#x1F39F;
        Te esperamos en la
        <strong>${LUGAR_RETIRO}</strong>
        del <strong>Rectorado</strong>
        para retirar tu/s entrada/s
        &#x1F39F;
      </p>
    `}

    ${pieCorreo()}

  </div>`;

  return enviarCorreo(
    correo,
    ASUNTOS.registro,
    cuerpoHTML
  );
}

/****************************************
 * 2) CONFIRMACIÓN DE RETIRO
 ****************************************/
function mailRetiro({
  invitado,
  numeros = [],
  comun = 0,
  celiacos = 0,
  vegetarianos = 0,
  veganos = 0,
  total = 0,
  mesa_token = null,
  es_manual = false
}) {

  if (!invitado || !invitado.correo) {
    return ContentService.createTextOutput(
      "Falta correo"
    );
  }

  const { importeTotal, valorCuota } =
    calcularPago(total, es_manual);

  const cuerpoHTML = `
  <div style="${ESTILOS.contenedor}">

    <h2 style="${ESTILOS.titulo}">
      Confirmación de Retiro
    </h2>

    <p>Hola <b>${invitado.nombre}</b>,</p>

    <p>
      Registramos el
      <b>retiro de tu(s) entrada(s)</b>.
    </p>

    <div style="${ESTILOS.detalle}">

      <p style="${ESTILOS.renglon}">
        <b>Cantidad de pulseras retiradas:</b>
        ${total}
      </p>

      <p style="${ESTILOS.renglon}">
        <b>Pulsera/s N°:</b>
        ${numeros.join(", ")}
      </p>

      ${detalleMenus({
        comun,
        celiacos,
        vegetarianos,
        veganos
      })}

      <p style="${ESTILOS.renglon}">
        <b>&#x1F4B0; Total:</b>
        $${importeTotal}
        —
        <b>Cuotas:</b>
        ${CANTIDAD_CUOTAS} de $${valorCuota}
      </p>

    </div>

    ${mensajeDescuento(es_manual)}

    ${enlaceMesas(mesa_token)}

    <p style="text-align:center;">
      ${MENSAJES.fiesta}
    </p>

    ${pieCorreo()}

  </div>`;

  return enviarCorreo(
    invitado.correo,
    ASUNTOS.retiro,
    cuerpoHTML
  );
}

/****************************************
 * 3) RESUMEN DE MESAS
 ****************************************/
function mailResumenMesas({
  invitado = {},
  asientos = [],
  mesa_token = null
}) {

  const { nombre, correo } = invitado;

  if (!correo || !Array.isArray(asientos)) {
    return ContentService.createTextOutput(
      "Datos incompletos"
    );
  }

  // Agrupar asientos por mesa.
  const mesasMap = {};

  asientos.forEach((a) => {
    if (!a.mesa) return;

    if (!mesasMap[a.mesa]) {
      mesasMap[a.mesa] = [];
    }

    mesasMap[a.mesa].push(a.posicion);
  });

  // Construir el resumen HTML.
  const resumen = Object.entries(mesasMap)
    .map(([mesa, posiciones]) => {

      const cantidad = posiciones.length;

      const palabraAsientos =
        cantidad > 1 ? "asientos" : "asiento";

      return `
        <li style="margin-bottom:6px;">
          <b>${cantidad}</b>
          ${palabraAsientos}
          en la <b>mesa ${mesa}</b>
        </li>`;
    })
    .join("");

  const cuerpoHTML = `
  <div style="${ESTILOS.contenedor}">

    <h2 style="${ESTILOS.titulo}">
      Confirmación de Asiento/s Seleccionado/s
    </h2>

    <p>Hola <b>${nombre}</b>,</p>

    <p>
      Confirmamos que seleccionaste
      el/los siguiente/s asiento/s:
    </p>

    <ul style="list-style:none;padding:0;margin:18px 0;">
      ${resumen || `
        <li>
          <i>No se registraron asientos.</i>
        </li>
      `}
    </ul>

    <p style="text-align:center;">
      Guardá este correo para recordar
      tu/s asiento/s.
    </p>

    ${enlaceMesas(mesa_token, 24)}

    <p style="text-align:center;font-size:1.2em;">
      ${MENSAJES.fiesta}
    </p>

    ${pieCorreo()}

  </div>`;

  return enviarCorreo(
    correo,
    ASUNTOS.mesas,
    cuerpoHTML
  );
}
