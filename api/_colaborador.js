const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

async function rest(path) {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return r.ok ? r.json() : []
}

export const titleCase = s => s.toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase())

export async function getColaborador(link) {
  if (!link || !url || !key) return null
  const [c] = await rest(`colaboradores?select=nombre,puesto,foto_url,hotel_id&activo=eq.true&link_unico=eq.${encodeURIComponent(link)}`)
  if (!c) return null
  const [h] = await rest(`hotels?select=nombre&id=eq.${c.hotel_id}`)
  return { nombre: titleCase(c.nombre), puesto: c.puesto, foto: c.foto_url, hotel: h?.nombre ?? null }
}
