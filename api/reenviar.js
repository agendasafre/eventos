import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SCRIPT_URL = process.env.SCRIPT_URL || process.env.APPS_SCRIPT_URL;
const INTERNAL_KEY = process.env.INTERNAL_KEY || process.env.INTERNAL_API_KEY; // opcional

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Configuración de Supabase incompleta.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function n(v) {
  const x = parseInt(v, 10);
  return Number.isNaN(x) ? 0 : x;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    if (!SCRIPT_URL) {
      return res.status(500).json({ error: 'Apps Script no configurado' });
    }

    if (INTERNAL_KEY) {
      const k = req.headers['x-internal-key'];
      if (!k || k !== INTERNAL_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
      }
    }

    const { tipo, dni, mesa_token, correo } = req.body || {};
    const tiposValidos = ['registro', 'retiro', 'mesas'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    // 1) Cargar invitado
    const sel = 'id, dni, nombre, correo, lugar_trabajo, mesa_token, es_manual, opciones_comun, opciones_celiacos, opciones_vegetarianos, opciones_veganos, retiro';
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
    } else {
      return res.status(400).json({ error: 'Falta DNI o mesa_token' });
    }

    if (!invitado) {
      return res.status(404).json({ error: 'Invitado no encontrado' });
    }

    // 2) Actualizar correo si corresponde
    let correoDestino = invitado.correo || '';
    if (correo && correo !== correoDestino) {
      const { error } = await supabase
        .from('invitados')
        .update({ correo })
        .eq('id', invitado.id);
      if (error) throw error;
      correoDestino = correo;
    }

    const comun = n(invitado.opciones_comun);
    const celiacos = n(invitado.opciones_celiacos);
    const vegetarianos = n(invitado.opciones_vegetarianos);
    const veganos = n(invitado.opciones_veganos);
    const total = comun + celiacos + vegetarianos + veganos;

    // 3) Armar payload al Apps Script
    let payload = null;
    if (tipo === 'registro') {
      payload = {
        action: invitado.es_manual ? 'mail_registro_manual' : 'mail_registro',
        dni: invitado.dni || '',
        nombre: invitado.nombre,
        correo: correoDestino,
        comun,
        celiacos,
        vegetarianos,
        veganos,
        total,
      };
    } else if (tipo === 'retiro') {
      // Obtener pulseras ya entregadas
      const { data: entradas, error: errEnt } = await supabase
        .from('entradas')
        .select('numero')
        .eq('dni_titular', invitado.dni)
        .eq('entregado', true)
        .order('numero', { ascending: true });
      if (errEnt) throw errEnt;
      const numeros = (entradas || []).map((e) => e.numero);

      payload = {
        action: 'mail_retiro',
        invitado: { nombre: invitado.nombre, correo: correoDestino },
        numeros,
        comun,
        celiacos,
        vegetarianos,
        veganos,
        total,
        mesa_token: invitado.mesa_token,
        es_manual: !!invitado.es_manual,
      };
    } else if (tipo === 'mesas') {
      // Obtener asientos actuales
      const { data: asientos, error: errAs } = await supabase
        .from('mesa_asientos')
        .select('posicion, mesas ( numero )')
        .eq('invitado_id', invitado.id)
        .order('mesa_id', { ascending: true })
        .order('posicion', { ascending: true });
      if (errAs) throw errAs;

      payload = {
        action: 'mail_mesas',
        invitado: { nombre: invitado.nombre, correo: correoDestino },
        asientos: (asientos || []).map((f) => ({ mesa: f.mesas?.numero, posicion: f.posicion })),
        mesa_token: invitado.mesa_token,
      };
    }

    // 4) Enviar
    try {
      const resp = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await resp.text();
      if (resp.ok) {
        return res.status(200).json({ message: 'Correo reenviado', response: text });
      }
      return res.status(502).json({ error: 'Apps Script respondió con error', response: text });
    } catch (mailErr) {
      console.error('Error al reenviar correo:', mailErr);
      return res.status(500).json({ error: 'No se pudo contactar Apps Script' });
    }
  } catch (err) {
    console.error('Error en /api/reenviar:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
