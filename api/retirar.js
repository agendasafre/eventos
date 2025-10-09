import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ⚠️ Pega tu URL real del Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxYourAppsScriptID/exec';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { dni, comun, celiacos, vegetarianos, veganos } = req.body || {};
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    // 1) Invitado
    const { data: invitado, error: errInv } = await supabase
      .from('invitados')
      .select('*')
      .eq('dni', dni)
      .maybeSingle();
    if (errInv) throw errInv;
    if (!invitado) return res.status(404).json({ error: 'Invitado no encontrado' });
    if (!invitado.acepto_terminos) return res.status(403).json({ error: 'No aceptó términos' });
    if (invitado.retiro) return res.status(409).json({ error: 'Ya retiró' });

    const total =
      (parseInt(comun) || 0) +
      (parseInt(celiacos) || 0) +
      (parseInt(vegetarianos) || 0) +
      (parseInt(veganos) || 0);

    if (total < 1) return res.status(400).json({ error: 'El total de menús debe ser mayor a 0' });

    // 2) ASIGNACIÓN ATÓMICA DE PULSERAS
    const { data: numeros, error: errRPC } = await supabase.rpc('asignar_pulseras', {
      p_cantidad: total,
      p_dni: dni,
    });
    if (errRPC) throw errRPC;

    // 3) Actualizar invitado (incluye campo opciones = total)
    const { error: errUpInv } = await supabase
      .from('invitados')
      .update({
        retiro: true,
        opciones: total, // 👈 FIX: actualizamos el total
        opciones_comun: parseInt(comun) || 0,
        opciones_celiacos: parseInt(celiacos) || 0,
        opciones_vegetarianos: parseInt(vegetarianos) || 0,
        opciones_veganos: parseInt(veganos) || 0,
      })
      .eq('id', invitado.id);

    if (errUpInv) {
      // 🔁 Revertir pulseras si falla la actualización del invitado
      await supabase
        .from('entradas')
        .update({ entregado: false, dni_titular: null })
        .in('numero', numeros || []);
      throw errUpInv;
    }

    // 4) Mail
    const payloadMail = {
      action: 'mail_retiro',
      invitado: { nombre: invitado.nombre, correo: invitado.correo },
      numeros,
      comun: parseInt(comun) || 0,
      celiacos: parseInt(celiacos) || 0,
      vegetarianos: parseInt(vegetarianos) || 0,
      veganos: parseInt(veganos) || 0,
      total,
      mesa_token: invitado.mesa_token,
    };
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadMail),
      });
    } catch (mailErr) {
      console.error('Error enviando correo:', mailErr);
      // no interrumpimos el retiro por fallas de mail
    }

    return res.status(200).json({ message: 'OK', numeros, total });
  } catch (err) {
    console.error('Error en /api/retirar:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
