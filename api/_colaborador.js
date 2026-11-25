const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

async function rest(path) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return r.ok ? r.json() : []
}

export const titleCase = s => s.toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase())

export async function getColaborador(link) {
  if (!link || !url || !key) return null
  // RPC security definer: solo el colaborador de esta liga (anon ya no lee la tabla directo).
  const r = await fetch(`${url}/rest/v1/rpc/get_colaborador_publico`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_link: link }),
  })
  const [c] = r.ok ? await r.json() : []
  if (!c) return null
  const [h] = await rest(`hotels?select=nombre&id=eq.${c.hotel_id}`)
  return { nombre: titleCase(c.nombre), puesto: c.puesto, foto: c.foto_url, hotel: h?.nombre ?? null }
}

export async function getDock(link) {
  if (!link || !url || !key) return null
  const r = await fetch(`${url}/rest/v1/rpc/get_punto_publico`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_link: link }),
  })
  const [d] = r.ok ? await r.json() : []
  return d ? { negocio: d.negocio_nombre, punto: d.punto_nombre, restaurante: d.tipo === 'restaurante', agradecer: d.modo === 'agradecer' || d.modo === 'ambos', pregunta: d.pregunta || null } : null
}

// Pulsera tak! de un admin (/k/:codigo)
export async function getTakTarjeta(codigo) {
  if (!codigo || !/^[a-z0-9]{6,16}$/.test(codigo) || !url || !key) return null
  const r = await fetch(`${url}/rest/v1/rpc/get_tak_tarjeta_publica`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_codigo: codigo }),
  })
  const [t] = r.ok ? await r.json() : []
  return t ? { nombre: titleCase(t.nombre) } : null
}
