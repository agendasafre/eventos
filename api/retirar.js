import { createClient } from '@supabase/supabase-js';

// 🔑 Supabase Service Key (no la anon key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// URL del Apps Script para enviar correos
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxYourAppsScriptID/exec'; // ⚠️ reemplazá con tu URL real

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { dni, comun, celiacos, vegetarianos, veganos } = req.body;
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    // 1️⃣ Buscar invitado
    const { data: invitado, error: errInv } = await supabase
      .from('invitados')
      .select('*')
      .eq('dni', dni)
      .maybeSingle();

    if (errInv) throw errInv;
    if (!invitado) return res.status(404).json({ error: 'Invitado no encontrado' });
    if (!invitado.acepto_terminos)
      return res.status(403).json({ error: 'El invitado no aceptó los términos' });
    if (invitado.retiro)
      return res.status(409).json({ error: 'El invitado ya retiró sus entradas' });

    // 2️⃣ Calcular total de menús
    const total =
      (parseInt(comun) || 0) +
      (parseInt(celiacos) || 0) +
      (parseInt(vegetarianos) || 0) +
      (parseInt(veganos) || 0);

    if (total < 1)
      return res.status(400).json({ error: 'El total de menús debe ser mayor a 0' });

    // 3️⃣ Buscar pulseras disponibles
    const { data: libres, error: errLibres } = await supabase
      .from('entradas')
      .select('numero')
      .eq('entregado', false)
      .order('numero', { ascending: true })
      .limit(total);

    if (errLibres) throw errLibres;
    if (!libres?.length)
      return res.status(409).json({ error: 'No hay pulseras disponibles' });

    const numeros = libres.map((e) => e.numero);

    // 4️⃣ Actualizar invitado
    const { error: errUpInv } = await supabase
      .from('invitados')
      .update({
        retiro: true,
        opciones_comun: comun || 0,
        opciones_celiacos: celiacos || 0,
        opciones_vegetarianos: vegetarianos || 0,
        opciones_veganos: veganos || 0,
      })
      .eq('id', invitado.id);

    if (errUpInv) throw errUpInv;

    // 5️⃣ Marcar entradas entregadas
    const { error: errEntradas } = await supabase
      .from('entradas')
      .update({ entregado: true, dni_titular: dni })
      .in('numero', numeros);

    if (errEntradas) throw errEntradas;

    // 6️⃣ Enviar correo vía Apps Script
    const payloadMail = {
      action: 'mail_retiro',
      invitado: {
        nombre: invitado.nombre,
        correo: invitado.correo,
      },
      numeros,
      comun,
      celiacos,
      vegetarianos,
      veganos,
      total,
      mesa_token: invitado.mesa_token,
    };

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payloadMail),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (mailErr) {
      console.error('Error enviando correo:', mailErr);
    }

    // 7️⃣ Responder OK
    return res.status(200).json({
      message: 'Retiro registrado correctamente',
      numeros,
      total,
    });
  } catch (err) {
    console.error('Error en /api/retirar:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
