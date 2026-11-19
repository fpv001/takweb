import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getColaborador, getDock } from './_colaborador.js'

const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) } })
const img = (src, width, height, style) => ({ type: 'img', props: { src, width, height, style } })
const font = f => readFile(join(process.cwd(), 'api/_fonts', f))
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

// Anti-SSRF: satori hace fetch server-side del <img src>. foto_url se escribe desde el
// panel (RLS por fila, no por columna), así que un gerente podría poner cualquier URL
// (p.ej. http://169.254.169.254/...). Solo se renderiza si es https y apunta al host de
// storage de Supabase; cualquier otra cosa cae al avatar de iniciales.
const STORAGE_HOST = (() => { try { return new URL(process.env.VITE_SUPABASE_URL).host } catch { return null } })()
const fotoSegura = u => {
  try { const x = new URL(u); return x.protocol === 'https:' && STORAGE_HOST && x.host === STORAGE_HOST ? u : null }
  catch { return null }
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const id = searchParams.get('id')
  const esDock = searchParams.get('k') === 'r'
  const d = esDock ? await getDock(id).catch(() => null) : null
  const c = esDock ? null : await getColaborador(id).catch(() => null)
  const nombre = esDock ? (d?.negocio ?? 'tu visita') : (c?.nombre ?? 'tu anfitrión')
  const meta = esDock ? (d?.punto ?? '') : c ? [c.puesto, c.hotel].filter(Boolean).join(' · ') : ''
  const etiqueta = esDock ? 'Cuéntanos de tu visita a:' : 'Agradece a:'
  const [bold, semi] = await Promise.all([font('Quicksand-Bold.otf'), font('Quicksand-SemiBold.otf')])

  // Dock: estrella de calificación en lugar de foto de colaborador
  const photo = esDock
    ? h('div', { width: 300, height: 300, borderRadius: 999, background: '#fff', alignItems: 'center', justifyContent: 'center' },
        { type: 'svg', props: { width: 170, height: 170, viewBox: '0 0 24 24', children: { type: 'path', props: { d: 'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z', fill: '#f57c73' } } } })
    : fotoSegura(c?.foto)
    ? img(fotoSegura(c.foto), 300, 300, { width: 300, height: 300, borderRadius: 999, objectFit: 'cover' })
    : h('div', { width: 300, height: 300, borderRadius: 999, background: '#fff', color: '#a83a34', fontSize: 120, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }, initials(nombre))

  // satori 0.33.5 (escapa bien el texto) + resvg para el PNG; @vercel/og 1.x no corre en ESM de Node
  const svg = await satori(
    h('div', { width: '100%', height: '100%', background: '#f57c73', fontFamily: 'Quicksand', color: '#fff', padding: '64px 80px', alignItems: 'center' },
      h('div', { flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', justifyContent: 'space-between' },
        img(`${origin}/public/assets/tak-logo.png`, 190, 106),
        h('div', { flexDirection: 'column' },
          h('div', { fontSize: 40, fontWeight: 600, color: '#fff3f1' }, etiqueta),
          h('div', { fontSize: nombre.length > 14 ? 76 : 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginTop: 8 }, nombre),
          meta && h('div', { alignSelf: 'flex-start', marginTop: 28, padding: '10px 26px', borderRadius: 999, background: 'rgba(255,255,255,.22)', fontSize: 30, fontWeight: 600 }, meta),
        ),
        h('div', { fontSize: 26, fontWeight: 600, color: '#fff3f1' }, 'thanksarekind.com'),
      ),
      h('div', { padding: 18, borderRadius: 999, background: 'rgba(255,255,255,.28)', marginLeft: 48, boxShadow: '0 30px 60px rgba(126,42,37,.35)' },
        h('div', { padding: 12, borderRadius: 999, background: '#fff' }, photo),
      ),
    ),
    {
      width: 1200, height: 630,
      fonts: [{ name: 'Quicksand', data: bold, weight: 700 }, { name: 'Quicksand', data: semi, weight: 600 }],
    },
  )
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
