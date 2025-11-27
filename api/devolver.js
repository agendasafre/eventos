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

    const { dni, motivo } = req.body || {};
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    // 1) Buscar invitado
    const { data: invitado, error: errInv } = await supabase
      .from('invitados')
      .select('id, nombre, correo, retiro, estado')
      .eq('dni', dni)
      .maybeSingle();
    if (errInv) throw errInv;
    if (!invitado) return res.status(404).json({ error: 'Invitado no encontrado' });

    // 2) Buscar entradas entregadas a este DNI
    const { data: entregadas, error: errEnt } = await supabase
      .from('entradas')
      .select('id, numero')
      .eq('dni_titular', dni)
      .eq('entregado', true)
      .order('numero', { ascending: true });
    if (errEnt) throw errEnt;

    if (!entregadas || entregadas.length === 0) {
      return res.status(409).json({ error: 'No hay entradas entregadas para este DNI' });
    }

    const ids = entregadas.map((e) => e.id);
//just a commet to deploy
    // 3) Revertir entradas (volver a disponibles)
    const { error: errRevert } = await supabase
      .from('entradas')
      .update({ entregado: false, dni_titular: null })
      .in('id', ids)
      .eq('entregado', true);

    if (errRevert) throw errRevert;

    const numeros = entregadas.map((e) => e.numero).sort((a, b) => (a ?? 0) - (b ?? 0));

    // 4) Liberar asientos elegidos (si los tuviera)
    const { error: errDelSeats } = await supabase
      .from('mesa_asientos')
      .delete()
      .eq('invitado_id', invitado.id);
    if (errDelSeats) throw errDelSeats;

    // 5) Actualizar invitado: marcar estado devuelto y bloquear re-selección de asiento (anulamos mesa_token)
    const { error: errUpdInv } = await supabase
      .from('invitados')
      .update({ estado: 'devuelto', mesa_token: null })
      .eq('id', invitado.id);

    if (errUpdInv) throw errUpdInv;

    // 6) Notificación por Apps Script (opcional, no bloqueante)
    if (SCRIPT_URL) {
      const payload = {
        action: 'mail_devolucion',
        invitado: { nombre: invitado.nombre, correo: invitado.correo, dni },
        numeros,
        motivo: motivo || '',
      };
      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (mailErr) {
        console.error('Error enviando correo de devolución:', mailErr);
      }
    }

    return res.status(200).json({
      message: 'Devolución registrada y entradas liberadas.',
      dni,
      numeros,
      invitado: { nombre: invitado.nombre, estado: 'devuelto', retiro: invitado.retiro },
    });
  } catch (err) {
    console.error('Error en /api/devolver:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
