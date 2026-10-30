const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

const LIMITES = { nombre: 120, negocio: 160, tipo: 40, correo: 200, mensaje: 3000 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  if (body.website) return res.status(200).json({ ok: true })

  const datos = Object.fromEntries(Object.keys(LIMITES).map(k => [k, String(body[k] ?? '').trim()]))
  const invalido = Object.entries(LIMITES).some(([k, max]) => !datos[k] || datos[k].length > max)
  if (invalido || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo)) return res.status(400).json({ error: 'Datos incompletos' })
  if (!url || !key) return res.status(500).json({ error: 'Servicio no configurado' })

  const r = await fetch(`${url}/rest/v1/rpc/registrar_lead`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_nombre: datos.nombre, p_negocio: datos.negocio, p_tipo: datos.tipo, p_correo: datos.correo, p_mensaje: datos.mensaje }),
  })
  if (!r.ok) return res.status(502).json({ error: 'No se pudo registrar' })
  res.status(200).json({ ok: true })
}
