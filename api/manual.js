// /api/manual.js
// Alta/actualización de invitados manuales (personal contratado, excepciones)
// Requiere SUPABASE_SERVICE_KEY. Protegé el acceso con una clave (X-Internal-Key) o vía ruta privada.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SCRIPT_URL = process.env.SCRIPT_URL || process.env.APPS_SCRIPT_URL;
const INTERNAL_KEY = process.env.INTERNAL_KEY || process.env.INTERNAL_API_KEY; // opcional

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function genToken(len = 32) {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Configuración de Supabase incompleta' });
    }

    // Protección simple por header (opcional pero recomendado)
    if (INTERNAL_KEY) {
      const k = req.headers['x-internal-key'];
      if (!k || k !== INTERNAL_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
      }
    }

    const {
      dni,
      nombre,
      correo,
      lugar,
      comun = 0,
      celiacos = 0,
      vegetarianos = 0,
      veganos = 0,
      enviar_mail = true,
    } = req.body || {};

    if (!nombre || !correo) {
      return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
    }

    // DNI es recomendado para retiro; permitimos vacío, pero advertimos
    if (!dni) {
      console.warn('Creando invitado manual sin DNI. El retiro podría no funcionar.');
    }

    const n = (v) => parseInt(v ?? 0, 10) || 0;
    const numComun = n(comun);
    const numCeliacos = n(celiacos);
    const numVegetarianos = n(vegetarianos);
    const numVeganos = n(veganos);
    const total = numComun + numCeliacos + numVegetarianos + numVeganos;
    if (total < 1) return res.status(400).json({ error: 'Seleccioná al menos un menú' });

    // Buscar si ya existe por DNI
    let existing = null;
    if (dni) {
      const { data: found, error: findErr } = await supabase
        .from('invitados')
        .select('id, retiro, estado, mesa_token')
        .eq('dni', dni)
        .maybeSingle();
      if (findErr) throw findErr;
      existing = found || null;
      if (existing?.retiro) {
        return res.status(409).json({ error: 'Ese DNI ya retiró sus entradas' });
      }
    }

    // Generar o reusar mesa_token
    let mesa_token = existing?.mesa_token;
    if (!mesa_token) {
      // intentar generar único (pocas probabilidades de colisión, chequeamos 3 intentos)
      for (let i = 0; i < 3; i++) {
        const candidate = genToken(16);
        const { data: clash, error: clashErr } = await supabase
          .from('invitados')
          .select('id')
          .eq('mesa_token', candidate)
          .maybeSingle();
        if (clashErr) throw clashErr;
        if (!clash) {
          mesa_token = candidate;
          break;
        }
      }
      if (!mesa_token) {
        return res.status(500).json({ error: 'No se pudo generar token de mesas' });
      }
    }

    const payload = {
      nombre,
      correo,
      dni: dni || null,
      lugar_trabajo: lugar || null,
      acepto_terminos: true,
      estado: 'registrado',
      retiro: false,
      opciones: total,
      opciones_comun: numComun,
      opciones_celiacos: numCeliacos,
      opciones_vegetarianos: numVegetarianos,
      opciones_veganos: numVeganos,
      es_manual: true,
      mesa_token,
    };

    let upserted = null;
    if (existing) {
      const { data, error } = await supabase
        .from('invitados')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      upserted = data;
    } else {
      const { data, error } = await supabase
        .from('invitados')
        .insert(payload)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      upserted = data;
    }

    // Enviar correo de registro si está configurado
    if (enviar_mail && SCRIPT_URL) {
      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mail_registro',
            dni: upserted?.dni || '',
            nombre: upserted?.nombre || nombre,
            correo,
            comun: numComun,
            celiacos: numCeliacos,
            vegetarianos: numVegetarianos,
            veganos: numVeganos,
            total,
          }),
        });
      } catch (mailErr) {
        console.warn('Fallo al enviar correo manual:', mailErr);
      }
    }

    return res.status(200).json({
      message: existing ? 'Invitado actualizado' : 'Invitado creado',
      mesa_token,
      invitado: { id: upserted?.id, dni: upserted?.dni, nombre: upserted?.nombre, correo: upserted?.correo },
    });
  } catch (err) {
    console.error('Error en /api/manual:', err);
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || 'Error interno' });
  }
}
