import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SCRIPT_URL = process.env.SCRIPT_URL || process.env.APPS_SCRIPT_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuración de Supabase incompleta' });
    }

    const { dni, nombre, correo, comun, celiacos, vegetarianos, veganos } = req.body || {};
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });
    if (!nombre || !correo) {
      return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
    }

    const n = (v) => {
      const parsed = parseInt(v, 10);
      if (Number.isNaN(parsed) || parsed < 0) return 0;
      return parsed;
    };

    const numComun = n(comun);
    const numCeliacos = n(celiacos);
    const numVegetarianos = n(vegetarianos);
    const numVeganos = n(veganos);

    // 1) Invitado
    const { data: invitado, error: errInv } = await supabase
      .from('invitados')
      .select('id, nombre, correo, retiro, estado, mesa_token, opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos')
      .eq('dni', dni)
      .maybeSingle();
    if (errInv) throw errInv;
    if (!invitado) return res.status(404).json({ error: 'Invitado no encontrado' });
    if (invitado.retiro) return res.status(409).json({ error: 'Ya retiró' });
    if (invitado.estado !== 'registrado') {
      return res.status(403).json({ error: 'El invitado no está habilitado para el retiro' });
    }

    const total = numComun + numCeliacos + numVegetarianos + numVeganos;

    if (total < 1) return res.status(400).json({ error: 'El total de menús debe ser mayor a 0' });

    // 2) Obtener primeras entradas disponibles
    const { data: disponibles, error: errDisponibles } = await supabase
      .from('entradas')
      .select('id, numero')
      .eq('entregado', false)
      .order('numero', { ascending: true })
      .limit(total);

    if (errDisponibles) throw errDisponibles;
    if (!disponibles || disponibles.length < total) {
      return res.status(409).json({ error: 'No hay suficientes entradas disponibles' });
    }

    const ids = disponibles.map((e) => e.id);

    const { data: asignadas, error: errAsignacion } = await supabase
      .from('entradas')
      .update({ entregado: true, dni_titular: dni })
      .in('id', ids)
      .eq('entregado', false)
      .select('id, numero')
      .order('numero', { ascending: true });

    if (errAsignacion) throw errAsignacion;
    if (!asignadas || asignadas.length !== total) {
      const revertIds = asignadas?.map((e) => e.id) || [];
      if (revertIds.length) {
        await supabase
          .from('entradas')
          .update({ entregado: false, dni_titular: null })
          .in('id', revertIds);
      }
      return res.status(409).json({ error: 'No se pudieron asignar todas las entradas solicitadas' });
    }

    const numeros = asignadas
      .map((e) => e.numero)
      .sort((a, b) => (a ?? 0) - (b ?? 0));

    // 3) Actualizar invitado (incluye campo opciones = total)
    const { error: errUpInv } = await supabase
      .from('invitados')
      .update({
        nombre,
        correo,
        retiro: true,
        estado: 'retirado',
        opciones: total,
        opciones_comun: numComun,
        opciones_celiacos: numCeliacos,
        opciones_vegetarianos: numVegetarianos,
        opciones_veganos: numVeganos,
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
    if (SCRIPT_URL) {
      const payloadMail = {
        action: 'mail_retiro',
        invitado: { nombre, correo },
        numeros,
        comun: numComun,
        celiacos: numCeliacos,
        vegetarianos: numVegetarianos,
        veganos: numVeganos,
        total,
        mesa_token: invitado.mesa_token,
      };
      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadMail),
        });
      } catch (mailErr) {
        console.error('Error enviando correo:', mailErr);
        // no interrumpimos el retiro por fallas de mail
      }
    }

    return res.status(200).json({
      message: `Retiro confirmado para ${nombre}.`,
      numeros,
      total,
    });
  } catch (err) {
    console.error('Error en /api/retirar:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
