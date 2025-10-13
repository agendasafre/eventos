// /api/register.js
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

  const { dni, correo, lugar, comun = 0, celiacos = 0, vegetarianos = 0, veganos = 0 } = req.body || {};

  if (!dni || !correo || !lugar) {
    return res.status(400).send('Faltan datos obligatorios.');
  }

  const n = (v) => parseInt(v ?? 0, 10) || 0;
  const numComun = n(comun);
  const numCeliacos = n(celiacos);
  const numVegetarianos = n(vegetarianos);
  const numVeganos = n(veganos);
  const total = numComun + numCeliacos + numVegetarianos + numVeganos;

  if (total < 1) {
    return res.status(400).send('Debés seleccionar al menos un menú.');
  }

  // Límite de tiempo
  const limite = new Date('2025-11-28T23:59:59');
  if (new Date() > limite) {
    return res.status(403).send('El período de registro ha finalizado.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1️⃣ Verificar si el invitado está autorizado
    const { data: invitado, error: findErr } = await supabase
      .from('invitados')
      .select('id, nombre, retiro')
      .eq('dni', dni)
      .single();

    if (findErr || !invitado) {
      return res.status(400).send('DNI no habilitado.');
    }

    if (invitado.retiro === true) {
      return res.status(409).send('Este DNI ya retiró su entrada.');
    }

    // 2️⃣ Actualizar datos en la tabla invitados (nombre tomado desde la base)
    const { error: updErr } = await supabase
      .from('invitados')
      .update({
        nombre: invitado.nombre,
        correo,
        acepto_terminos: true,
        lugar_trabajo: lugar,
        opciones: total,
        opciones_comun: numComun,
        opciones_celiacos: numCeliacos,
        opciones_vegetarianos: numVegetarianos,
        opciones_veganos: numVeganos,
        estado: 'registrado',
      })
      .eq('dni', dni);

    if (updErr) {
      console.error('Error al actualizar invitado:', updErr);
      return res.status(500).send('No se pudo guardar el registro.');
    }

    // 3️⃣ Enviar correo con Apps Script
    const mailPayload = {
      action: 'mail_registro',
      dni,
      nombre: invitado.nombre,
      correo,
      comun: numComun,
      celiacos: numCeliacos,
      vegetarianos: numVegetarianos,
      veganos: numVeganos,
      total,
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

    return res.status(200).send('Registro exitoso. Te enviamos un correo de confirmación.');
  } catch (err) {
    console.error('Error general en /api/register:', err);
    return res.status(500).send('Error interno al procesar el registro.');
  }
}
