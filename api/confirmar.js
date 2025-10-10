import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SCRIPT_URL = process.env.SCRIPT_URL || process.env.APPS_SCRIPT_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Configuración de Supabase incompleta.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function totalMenus(invitado) {
  if (!invitado) return 0;
  return (
    (invitado.opciones_comun || 0) +
    (invitado.opciones_celiacos || 0) +
    (invitado.opciones_vegetarianos || 0) +
    (invitado.opciones_veganos || 0)
  );
}

function seatKey(mesaId, posicion) {
  return `${mesaId}:${posicion}`;
}

function validatePayload(asientos) {
  if (!Array.isArray(asientos)) return 'Formato de asientos inválido';
  for (const seat of asientos) {
    if (!seat) return 'Datos de asiento incompletos';
    if (!seat.mesa_id || !seat.posicion) return 'Cada asiento necesita mesa y posición';
    if (seat.posicion < 1 || seat.posicion > 8) return 'Posición de asiento inválida';
    if (seat.cambios != null && (seat.cambios < 0 || seat.cambios > 2)) {
      return 'Cantidad de cambios inválida';
    }
  }
  const keys = new Set(asientos.map((s) => seatKey(s.mesa_id, s.posicion)));
  if (keys.size !== asientos.length) return 'Hay posiciones duplicadas en la selección';
  return null;
}

async function removePlaceholderSeat(mesaId, posicion) {
  const { error } = await supabase
    .from('mesa_asientos')
    .delete()
    .eq('mesa_id', mesaId)
    .eq('posicion', posicion)
    .is('invitado_id', null);
  if (error) throw error;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const { token, asientos } = req.body || {};

    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const payloadError = validatePayload(asientos || []);
    if (payloadError) return res.status(400).json({ error: payloadError });

    const { data: invitado, error: invitadoErr } = await supabase
      .from('invitados')
      .select(
        `id, nombre, correo, mesa_token,
         opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos`
      )
      .eq('mesa_token', token)
      .maybeSingle();

    if (invitadoErr) throw invitadoErr;
    if (!invitado) return res.status(404).json({ error: 'Invitado no encontrado' });

    const cupos = totalMenus(invitado);
    if (cupos < 1) {
      return res.status(400).json({ error: 'No tenés asientos habilitados para seleccionar' });
    }

    if ((asientos || []).length !== cupos) {
      return res.status(400).json({
        error: `Debés seleccionar exactamente ${cupos} asiento${cupos !== 1 ? 's' : ''}.`,
      });
    }

    const { data: actuales, error: actualesErr } = await supabase
      .from('mesa_asientos')
      .select('id, mesa_id, posicion, cambios')
      .eq('invitado_id', invitado.id);

    if (actualesErr) throw actualesErr;

    const actualesMap = new Map();
    (actuales || []).forEach((seat) => actualesMap.set(seat.id, seat));

    const desiredById = new Map();
    const desiredNew = [];

    for (const seat of asientos || []) {
      if (seat.id) desiredById.set(seat.id, seat);
      else desiredNew.push(seat);
    }

    desiredById.forEach((_, id) => {
      if (!actualesMap.has(id)) {
        throw createHttpError(400, 'Detectamos un asiento inválido en tu selección.');
      }
    });

    const toRelease = [];
    const toMove = [];

    actualesMap.forEach((seat, id) => {
      const desired = desiredById.get(id);
      if (!desired) {
        toRelease.push(seat);
        return;
      }
      const requestedCambios = desired.cambios ?? seat.cambios ?? 0;
      if (requestedCambios > 2) {
        throw createHttpError(400, 'No podés cambiar un asiento más de 2 veces.');
      }
      const cappedCambios = Math.min(requestedCambios, 2);
      if (seat.mesa_id !== desired.mesa_id || seat.posicion !== desired.posicion) {
        toMove.push({
          ...seat,
          targetMesaId: desired.mesa_id,
          targetPosicion: desired.posicion,
          targetCambios: cappedCambios,
        });
      } else if (cappedCambios !== (seat.cambios || 0)) {
        toMove.push({
          ...seat,
          targetMesaId: seat.mesa_id,
          targetPosicion: seat.posicion,
          targetCambios: cappedCambios,
        });
      }
    });

    const appliedMoves = [];
    const appliedInserts = [];
    const appliedReleases = [];

    const revert = async () => {
      // revert in reverse order
      for (const release of appliedReleases.reverse()) {
        await supabase
          .from('mesa_asientos')
          .update({ invitado_id: invitado.id, cambios: release.cambios || 0 })
          .eq('id', release.id);
      }

      for (const insert of appliedInserts.reverse()) {
        await supabase
          .from('mesa_asientos')
          .delete()
          .eq('id', insert.id);
      }

      for (const move of appliedMoves.reverse()) {
        await removePlaceholderSeat(move.originalMesaId, move.originalPosicion);
        await supabase
          .from('mesa_asientos')
          .update({
            mesa_id: move.originalMesaId,
            posicion: move.originalPosicion,
            cambios: move.originalCambios,
          })
          .eq('id', move.id)
          .eq('invitado_id', invitado.id);
      }
    };

    try {
      // Moves (includes cambios updates)
      for (const move of toMove) {
        await removePlaceholderSeat(move.targetMesaId, move.targetPosicion);

        const { data, error } = await supabase
          .from('mesa_asientos')
          .update({
            mesa_id: move.targetMesaId,
            posicion: move.targetPosicion,
            cambios: Math.min(move.targetCambios ?? 0, 2),
            invitado_id: invitado.id,
          })
          .eq('id', move.id)
          .eq('invitado_id', invitado.id)
          .select();

        if (error) {
          if (error.code === '23505') {
            throw createHttpError(409, 'El asiento seleccionado ya no está disponible.');
          }
          throw error;
        }
        if (!data || !data.length) {
          throw createHttpError(409, 'El asiento seleccionado ya no está disponible.');
        }

        appliedMoves.push({
          id: move.id,
          originalMesaId: move.mesa_id,
          originalPosicion: move.posicion,
          originalCambios: move.cambios || 0,
        });
      }

      // Nuevos asientos
      for (const seat of desiredNew) {
        await removePlaceholderSeat(seat.mesa_id, seat.posicion);

        const { data, error } = await supabase
          .from('mesa_asientos')
          .insert({
            mesa_id: seat.mesa_id,
            posicion: seat.posicion,
            invitado_id: invitado.id,
            cambios: Math.min(seat.cambios ?? 0, 2),
          })
          .select();

        if (error) {
          if (error.code === '23505') {
            throw createHttpError(409, 'Uno de los asientos seleccionados ya fue tomado.');
          }
          throw error;
        }
        if (!data || !data.length) {
          throw createHttpError(409, 'No pudimos reservar uno de los asientos seleccionados.');
        }

        appliedInserts.push(data[0]);
      }

      // Liberar asientos quitados
      for (const seat of toRelease) {
        const { data, error } = await supabase
          .from('mesa_asientos')
          .update({ invitado_id: null })
          .eq('id', seat.id)
          .eq('invitado_id', invitado.id)
          .select('id');

        if (error) throw error;
        if (!data || !data.length) {
          throw createHttpError(409, 'No pudimos liberar uno de tus asientos previos.');
        }
        appliedReleases.push(seat);
      }
    } catch (err) {
      await revert();
      throw err;
    }

    const { data: finales, error: finalesErr } = await supabase
      .from('mesa_asientos')
      .select('mesa_id, posicion, cambios, mesas ( numero )')
      .eq('invitado_id', invitado.id)
      .order('mesa_id', { ascending: true })
      .order('posicion', { ascending: true });

    if (finalesErr) throw finalesErr;

    if (SCRIPT_URL) {
      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mail_mesas',
            invitado: {
              nombre: invitado.nombre,
              correo: invitado.correo,
            },
            asientos: finales?.map((f) => ({
              mesa: f.mesas?.numero,
              posicion: f.posicion,
            })),
            mesa_token: invitado.mesa_token,
          }),
        });
      } catch (mailErr) {
        console.error('Error enviando correo de confirmación de mesas:', mailErr);
      }
    }

    return res.status(200).json({
      message: 'Guardamos tu selección de mesas correctamente.',
      asientos: finales || [],
    });
  } catch (err) {
    console.error('Error en /api/mesas/confirmar:', err);
    const status = err?.code === '23505' ? 409 : 500;
    const msg = err?.message || 'Error interno al confirmar mesas';
    return res.status(status).json({ error: msg });
  }
}
