import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const INTERNAL_KEY = process.env.INTERNAL_KEY || process.env.INTERNAL_API_KEY; // opcional

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Configuración de Supabase incompleta.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    if (INTERNAL_KEY) {
      const k = req.headers['x-internal-key'];
      if (!k || k !== INTERNAL_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
      }
    }

    const { dni, mesa_token, correo } = req.body || {};
    if (!correo) return res.status(400).json({ error: 'Correo requerido' });
    if (!dni && !mesa_token) return res.status(400).json({ error: 'Falta DNI o mesa_token' });

    const sel = 'id, dni, nombre, correo, mesa_token';
    let invitado = null;
    if (dni) {
      const { data, error } = await supabase
        .from('invitados')
        .select(sel)
        .eq('dni', dni)
        .maybeSingle();
      if (error) throw error;
      invitado = data;
    } else if (mesa_token) {
      const { data, error } = await supabase
        .from('invitados')
        .select(sel)
        .eq('mesa_token', mesa_token)
        .maybeSingle();
      if (error) throw error;
      invitado = data;
    }

    if (!invitado) return res.status(404).json({ error: 'Invitado no encontrado' });

    const { error: updErr } = await supabase
      .from('invitados')
      .update({ correo })
      .eq('id', invitado.id);
    if (updErr) throw updErr;

    return res.status(200).json({ message: 'Correo actualizado', correo });
  } catch (err) {
    console.error('Error en /api/actualizar-correo:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
