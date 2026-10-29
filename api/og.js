import { ImageResponse } from '@vercel/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getColaborador } from './_colaborador.js'

const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) } })
const img = (src, width, height, style) => ({ type: 'img', props: { src, width, height, style } })
const font = f => readFile(join(process.cwd(), 'api/_fonts', f))
const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const c = await getColaborador(searchParams.get('id')).catch(() => null)
  const nombre = c?.nombre ?? 'tu anfitrión'
  const meta = c ? [c.puesto, c.hotel].filter(Boolean).join(' · ') : ''
  const [bold, semi] = await Promise.all([font('Quicksand-Bold.otf'), font('Quicksand-SemiBold.otf')])

  const photo = c?.foto
    ? img(c.foto, 300, 300, { width: 300, height: 300, borderRadius: 999, objectFit: 'cover' })
    : h('div', { width: 300, height: 300, borderRadius: 999, background: '#fff', color: '#a83a34', fontSize: 120, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }, initials(nombre))

  return new ImageResponse(
    h('div', { width: '100%', height: '100%', background: '#f57c73', fontFamily: 'Quicksand', color: '#fff', padding: '64px 80px', alignItems: 'center' },
      h('div', { flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', justifyContent: 'space-between' },
        img(`${origin}/public/assets/tak-logo.png`, 190, 106),
        h('div', { flexDirection: 'column' },
          h('div', { fontSize: 40, fontWeight: 600, color: '#fff3f1' }, 'Agradece a:'),
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
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    },
  )
}
