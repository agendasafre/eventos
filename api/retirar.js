import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SCRIPT_URL = process.env.SCRIPT_URL;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SCRIPT_URL) {
    return res.status(500).send('Falta configuración del servidor.');
  }

  const { dni, comun = 0, celiacos = 0, vegetarianos = 0, veganos = 0 } = req.body || {};
  const n = (v) => parseInt(v ?? 0, 10) || 0;

  if (!dni) return res.status(400).send('DNI faltante.');

  const total = n(comun) + n(celiacos) + n(vegetarianos) + n(veganos);
  if (total < 1) {
    return res.status(400).send('Debés ingresar al menos un menú retirado.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1️⃣ Buscar invitado
    const { data: invitado, error: findErr } = await supabase
      .from('invitados')
      .select('*')
      .eq('dni', dni)
      .maybeSingle();

    if (findErr || !invitado) {
      return res.status(404).send('Invitado no encontrado.');
    }

    if (invitado.retiro === true) {
      return res.status(409).send('Este invitado ya retiró sus entradas.');
    }

    // 2️⃣ Actualizar estado y cantidades
    const { error: updErr } = await supabase
      .from('invitados')
      .update({
        retiro: true,
        opciones_comun: n(comun),
        opciones_celiacos: n(celiacos),
        opciones_vegetarianos: n(vegetarianos),
        opciones_veganos: n(veganos),
        opciones: total,
        estado: 'retirado',
      })
      .eq('dni', dni);

    if (updErr) {
      console.error('Error al actualizar retiro:', updErr);
      return res.status(500).send('No se pudo registrar el retiro.');
    }

    // 3️⃣ Enviar correo con Apps Script
    const mailPayload = {
      action: 'mail_retiro',
      invitado: {
        nombre: invitado.nombre,
        correo: invitado.correo,
      },
      numeros: [], // si luego querés agregar Nº de pulsera, podés pasar array
      comun: n(comun),
      celiacos: n(celiacos),
      vegetarianos: n(vegetarianos),
      veganos: n(veganos),
      total,
      mesa_token: invitado.mesa_token ?? null,
    };

    const mailResp = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailPayload),
    });

    const mailText = await mailResp.text();
    if (mailText.trim() !== 'OK') {
      console.warn('Apps Script respondió:', mailText);
    }

    return res.status(200).send('Retiro registrado y correo enviado.');
  } catch (err) {
    console.error('Error general en /api/retirar:', err);
    return res.status(500).send('Error interno al procesar el retiro.');
  }
}
