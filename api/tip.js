import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getColaborador, getDock } from './_colaborador.js'

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Vista previa de las ligas que se comparten: /tip/:id (pulsera de colaborador) y /r/:id (dock de reseñas)
async function preview(kind, id) {
  if (kind === 'r') {
    const d = await getDock(id).catch(() => null)
    if (!d) return null
    if (d.agradecer) return {
      title: `${d.pregunta || '¿A quién quieres agradecer?'} · ${d.negocio}`,
      desc: `${d.punto}. Agradece a quien te atendió con tak!`,
      path: `/r/${id}`,
    }
    return {
      title: `Cuéntanos de tu visita a ${d.negocio}`,
      desc: `${d.punto}. ${d.restaurante ? 'Califica tu experiencia y lo que comiste con tak!' : 'Deja tu reseña con tak!'}`,
      path: `/r/${id}`,
    }
  }
  const c = await getColaborador(id).catch(() => null)
  if (!c) return null
  return {
    title: `Agradece a: ${c.nombre}`,
    desc: [[c.puesto, c.hotel].filter(Boolean).join(' · '), 'Déjale una reseña o una propina con tak!'].filter(Boolean).join('. '),
    path: `/tip/${id}`,
  }
}

export default async function handler(req, res) {
  const id = String(req.query.id || '')
  const kind = req.query.k === 'r' ? 'r' : 'tip'
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  let html
  try { html = await readFile(join(process.cwd(), 'admin/index.html'), 'utf8') }
  catch { html = await (await fetch(`${origin}/admin/index.html`)).text() }

  // Sin datos (liga inválida o inactiva) nunca se muestra "tak! · panel"
  const p = await preview(kind, id) ?? {
    title: 'tak! · Agradecimientos que cuentan',
    desc: 'Reseñas y propinas digitales con tak!',
    path: kind === 'r' ? `/r/${id}` : `/tip/${id}`,
    fallback: true,
  }
  const img = p.fallback ? `${origin}/public/assets/og-image.jpg` : `${origin}/api/og?${kind === 'r' ? 'k=r&' : ''}id=${encodeURIComponent(id)}`
  const meta = [
    ['property', 'og:type', 'website'], ['property', 'og:site_name', 'tak!'],
    ['property', 'og:title', p.title], ['property', 'og:description', p.desc],
    ['property', 'og:url', `${origin}${p.path}`],
    ['property', 'og:image', img], ...(p.fallback ? [] : [['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630']]),
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', p.title],
    ['name', 'twitter:description', p.desc], ['name', 'twitter:image', img], ['name', 'description', p.desc],
  ].map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}" />`).join('\n    ')
  // Función como reemplazo: así un nombre con "$&" o "$`" no se interpreta como patrón especial
  const head = `<title>${esc(p.fallback ? p.title : `${p.title} · tak!`)}</title>\n    ${meta}`
  html = html.replace(/<title>.*?<\/title>/, () => head)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.status(p.fallback ? 404 : 200).send(html)
}
