import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { detectLang, formatMXN } from '@/lib/utils'
import { enviarCalificacionesPlatillos, type PlatilloPublico } from '@/lib/platillos'
import { Alert, Avatar, Btn } from '@/components/UI'
import { Icon } from '@/components/Icon'
import { PlatillosCalificar, faltanEstrellasPlatillos, mensajeFaltanEstrellas, type PlatilloElegido } from '@/components/PlatillosCalificar'

// Agradecer a varias personas desde un dock en una sola acción: estrellas para cada quien,
// un comentario, los platillos y una propina que se divide entre todos o va completa a cada uno.
// Se guarda una reseña y una propina por persona (mismas tablas que /tip), ligadas al dock.

type Miembro = { nombre: string; puesto: string | null; foto_url: string | null; link_unico: string }
type Persona = Miembro & { id: string; hotel_id: string }

const MONTOS = [50, 100, 200]

const textos = {
  es: {
    hello: 'Agradece a',
    rateEach: 'Califica a cada quien',
    comment: 'Cuéntales algo (opcional)...',
    dishesTitle: '¿Qué les trajeron?',
    dishesSub: 'Toca los platillos que probaste y califícalos',
    tipTitle: 'Propina',
    tipSub: 'Opcional',
    other: 'Otro monto',
    split: 'Dividir entre todos',
    each: 'A cada quien',
    breakdown: (n: number, m: string) => `${m} para cada una de las ${n} personas`,
    pay: (m: string) => `Pagar ${m}`,
    send: 'Enviar',
    sending: 'Enviando...',
    needSomething: 'Ponle estrellas a alguien o elige una propina.',
    saveError: 'No se pudo guardar todo. Intenta de nuevo.',
    tipError: 'Tu calificación quedó guardada, pero la propina no se pudo procesar.',
    thanks: '¡Gracias!',
    thanksText: (n: string) => `Tu agradecimiento llegó a ${n}.`,
    dishesThanks: (n: number) => n === 1 ? 'También guardamos la calificación de tu platillo.' : `También guardamos la calificación de tus ${n} platillos.`,
    back: 'Cambiar personas',
    ratePlace: 'Calificar el lugar',
    star: (n: number) => `${n} de 5 estrellas`,
    and: 'y',
  },
  en: {
    hello: 'Thank',
    rateEach: 'Rate each person',
    comment: 'Tell them something (optional)...',
    dishesTitle: 'What did they bring you?',
    dishesSub: 'Tap the dishes you tried and rate them',
    tipTitle: 'Tip',
    tipSub: 'Optional',
    other: 'Other amount',
    split: 'Split among everyone',
    each: 'To each person',
    breakdown: (n: number, m: string) => `${m} for each of the ${n} people`,
    pay: (m: string) => `Pay ${m}`,
    send: 'Send',
    sending: 'Sending...',
    needSomething: 'Rate someone or choose a tip.',
    saveError: 'We could not save everything. Please try again.',
    tipError: 'Your rating was saved, but the tip could not be processed.',
    thanks: 'Thank you!',
    thanksText: (n: string) => `Your thanks reached ${n}.`,
    dishesThanks: (n: number) => n === 1 ? 'We also saved your dish rating.' : `We also saved the ratings for your ${n} dishes.`,
    back: 'Change people',
    ratePlace: 'Rate the place',
    star: (n: number) => `${n} out of 5 stars`,
    and: 'and',
  },
}

const primerNombre = (n: string) => n.split(' ')[0].toLowerCase().replace(/^\p{L}/u, c => c.toUpperCase())

// Reparte en centavos: el sobrante de la división va a los primeros
function repartir(totalCentavos: number, n: number) {
  const base = Math.floor(totalCentavos / n)
  return Array.from({ length: n }, (_, i) => base + (i < totalCentavos - base * n ? 1 : 0))
}

type Props = {
  dockLink: string
  puntoId: string
  miembros: Miembro[]
  platillos: PlatilloPublico[]
  conLugar: boolean
  onBack: () => void
  onRatePlace: () => void
}

export function AgradecerGrupo({ dockLink, puntoId, miembros, platillos, conLugar, onBack, onRatePlace }: Props) {
  const t = textos[detectLang()]
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  const [estrellas, setEstrellas] = useState<Record<string, number>>({})
  const [comentario, setComentario] = useState('')
  const [elegidos, setElegidos] = useState<PlatilloElegido[]>([])
  const [monto, setMonto] = useState(0)
  const [otro, setOtro] = useState('')
  const [modo, setModo] = useState<'dividir' | 'cada'>('dividir')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ platillos: number; aviso: string } | null>(null)

  useEffect(() => {
    Promise.all(miembros.map(async m => {
      const { data } = await supabase.rpc('get_colaborador_publico', { p_link: m.link_unico }).maybeSingle()
      const d = data as { id: string; hotel_id: string } | null
      return d ? { ...m, id: d.id, hotel_id: d.hotel_id } : null
    })).then(r => setPersonas(r.filter((p): p is Persona => !!p)))
  }, [miembros])

  const nombres = (personas ?? miembros).map(p => primerNombre(p.nombre))
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} ${t.and} ${nombres[nombres.length - 1]}` : nombres[0] ?? ''

  const montoElegido = otro ? Math.max(0, Number(otro) || 0) : monto
  const n = personas?.length ?? 0
  const centavos = Math.round(montoElegido * 100)
  const porPersona = n ? (modo === 'dividir' ? repartir(centavos, n) : Array(n).fill(centavos)) : []
  const total = porPersona.reduce((a, b) => a + b, 0)
  const alguienCalificado = Object.values(estrellas).some(v => v > 0)

  async function enviar() {
    if (!personas?.length || saving) return
    if (!alguienCalificado && !total) { setError(t.needSomething); return }
    if (faltanEstrellasPlatillos(elegidos)) { setError(mensajeFaltanEstrellas()); return }
    setSaving(true)
    setError('')
    try {
      // 1. Una reseña por persona calificada (o con comentario)
      const texto = comentario.trim() || null
      const resenas: Record<string, string> = {}
      for (const p of personas) {
        const e = estrellas[p.id] ?? 0
        if (!e && !texto) continue
        const id = crypto.randomUUID()
        const { error: err } = await supabase.from('resenas').insert({
          id, estrellas: e || null, comentario: texto, publica: false,
          hotel_id: p.hotel_id, colaborador_id: p.id, punto_id: puntoId,
        })
        if (err) throw err
        resenas[p.id] = id
      }

      // 2. Platillos: van con la primera reseña del dock
      let platillosOk = 0
      const primera = Object.values(resenas)[0]
      if (primera && elegidos.length) {
        const errP = await enviarCalificacionesPlatillos(dockLink, primera, elegidos.map(e => ({ platillo_id: e.id, estrellas: e.estrellas, comentario: e.comentario })))
        if (errP) console.error('Error guardando calificaciones de platillos:', errP)
        else platillosOk = elegidos.length
      }

      // 3. Propina: una por persona con su parte, ligada a su reseña
      let aviso = ''
      if (total) {
        try {
          for (const [i, p] of personas.entries()) {
            const cents = porPersona[i]
            if (!cents) continue
            const { data: propina, error: errT } = await supabase.from('propinas').insert({
              hotel_id: p.hotel_id, colaborador_id: p.id, monto_total: cents / 100,
              stripe_payment_id: `manual_${Date.now()}_${i}`, estado: 'completado',
            }).select().single()
            if (errT) throw errT
            await supabase.from('repartos').insert({ propina_id: propina.id, colaborador_id: p.id, monto: cents / 100, estado: 'pendiente' })
            if (resenas[p.id]) {
              const { error: errL } = await supabase.rpc('actualizar_resena_huesped', { p_link: p.link_unico, p_resena_id: resenas[p.id], p_propina_id: propina.id })
              if (errL) console.error('Error ligando reseña y propina:', errL)
            }
          }
        } catch (err) {
          console.error('Error creando propinas del grupo:', err)
          if (!Object.keys(resenas).length) throw err
          aviso = t.tipError
        }
      }
      setDone({ platillos: platillosOk, aviso })
    } catch (err) {
      console.error('Error en agradecer a varios:', err)
      setError(t.saveError)
    } finally {
      setSaving(false)
    }
  }

  const avatares = (
    <div className="tk-group-avatars" aria-hidden="true">
      {(personas ?? miembros).slice(0, 4).map(p => <Avatar key={p.link_unico} name={p.nombre} src={p.foto_url} size={72} />)}
    </div>
  )

  const header = (
    <header className="tk-ghead">
      {avatares}
      <div>
        <p className="tk-ghead__hello">{t.hello}</p>
        <h1 className="tk-ghead__name tk-ghead__name--group">{lista}</h1>
      </div>
    </header>
  )

  if (done) return (
    <>
      {header}
      <main className="tk-gcard">
        <div className="tk-success" role="status">
          <span className="tk-success__mark"><Icon name="check" /></span>
          <h1 className="tk-success__title">{t.thanks}</h1>
          <p className="tk-success__text">{t.thanksText(lista)}</p>
          {done.platillos > 0 && <p className="tk-success__text">{t.dishesThanks(done.platillos)}</p>}
          {done.aviso && <Alert>{done.aviso}</Alert>}
          {conLugar && <Btn variant="secondary" icon="star" onClick={onRatePlace} block>{t.ratePlace}</Btn>}
        </div>
      </main>
    </>
  )

  return (
    <>
      {header}
      <main className="tk-gcard">
        <Btn variant="text" icon="back" onClick={onBack}>{t.back}</Btn>
        <div>
          <h2 className="tk-gtitle">{t.rateEach}</h2>
          <div className="tk-group-rates">
            {(personas ?? []).map(p => (
              <div key={p.id} className="tk-group-rate">
                <Avatar name={p.nombre} src={p.foto_url} size={44} />
                <div className="tk-group-rate__who">
                  <p className="tk-group-rate__name">{p.nombre.toLowerCase()}</p>
                  {p.puesto && <p className="tk-group-rate__role">{p.puesto}</p>}
                </div>
                <div className="tk-rate tk-rate--sm" role="group" aria-label={p.nombre}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} type="button" className={s <= (estrellas[p.id] ?? 0) ? 'is-on' : undefined}
                      onClick={() => { setError(''); setEstrellas(prev => ({ ...prev, [p.id]: s })) }}
                      aria-label={t.star(s)} aria-pressed={s === estrellas[p.id]}>
                      <Icon name="star" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <label className="tk-field">
            <span className="tk-sr">{t.comment}</span>
            <textarea className="tk-textarea" placeholder={t.comment} value={comentario} onChange={e => setComentario(e.target.value)} rows={3} />
          </label>

          <PlatillosCalificar platillos={platillos} elegidos={elegidos} marcarFaltantes={!!error}
            titulo={t.dishesTitle} subtitulo={t.dishesSub} onChange={v => { setError(''); setElegidos(v) }} />

          <section className="tk-group-tip">
            <h2 className="tk-gtitle" style={{ marginBottom: 4 }}>{t.tipTitle}</h2>
            <p className="tk-dishes__sub">{t.tipSub}</p>
            <div className="tk-segment" role="radiogroup" aria-label={t.tipTitle}>
              {(['dividir', 'cada'] as const).map(m => (
                <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)}>
                  {m === 'dividir' ? t.split : t.each}
                </button>
              ))}
            </div>
            <div className="tk-amounts" role="group" aria-label={t.tipTitle}>
              {MONTOS.map(a => (
                <button key={a} type="button" className="tk-amount" aria-pressed={monto === a && !otro}
                  onClick={() => { setError(''); setOtro(''); setMonto(monto === a ? 0 : a) }}>
                  <span className="tk-amount__value">${a}</span>
                  <span className="tk-amount__cur">MXN</span>
                </button>
              ))}
            </div>
            <label className="tk-field">
              <span className="tk-sr">{t.other}</span>
              <span className="tk-input-wrap">
                <input className="tk-input" type="number" inputMode="decimal" min={0} placeholder={t.other} value={otro}
                  onChange={e => { setError(''); setOtro(e.target.value); setMonto(0) }} style={{ paddingRight: 64 }} />
                <span className="tk-input-wrap__suffix">MXN</span>
              </span>
            </label>
            {total > 0 && n > 1 && (
              <p className="tk-group-tip__split">
                {modo === 'dividir'
                  ? personas!.map((p, i) => `${primerNombre(p.nombre)} ${formatMXN(porPersona[i] / 100)}`).join(' · ')
                  : t.breakdown(n, formatMXN(centavos / 100))}
              </p>
            )}
          </section>

          {error && <Alert>{error}</Alert>}

          <div className="tk-paybar">
            <Btn icon={saving ? undefined : total ? 'tip' : undefined} onClick={enviar} disabled={saving || !personas?.length} loading={saving} block>
              {saving ? t.sending : total ? t.pay(formatMXN(total / 100)) : t.send}
            </Btn>
          </div>
        </div>
      </main>
    </>
  )
}
