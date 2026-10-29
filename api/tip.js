import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getColaborador } from './_colaborador.js'

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export default async function handler(req, res) {
  const id = String(req.query.id || '')
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  let html
  try { html = await readFile(join(process.cwd(), 'admin/index.html'), 'utf8') }
  catch { html = await (await fetch(`${origin}/admin/index.html`)).text() }

  const c = await getColaborador(id).catch(() => null)
  if (c) {
    const title = `Agradece a: ${c.nombre}`
    const desc = [[c.puesto, c.hotel].filter(Boolean).join(' · '), 'Déjale una reseña o una propina con tak!'].filter(Boolean).join('. ')
    const img = `${origin}/api/og?id=${encodeURIComponent(id)}`
    const meta = [
      ['property', 'og:type', 'website'], ['property', 'og:site_name', 'tak!'],
      ['property', 'og:title', title], ['property', 'og:description', desc],
      ['property', 'og:url', `${origin}/tip/${id}`],
      ['property', 'og:image', img], ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'],
      ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', title],
      ['name', 'twitter:description', desc], ['name', 'twitter:image', img], ['name', 'description', desc],
    ].map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}" />`).join('\n    ')
    html = html.replace(/<title>.*?<\/title>/, `<title>${esc(title)} · tak!</title>\n    ${meta}`)
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.status(c ? 200 : 404).send(html)
}
