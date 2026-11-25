import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { detectLang } from '@/lib/utils'
import { copiarTexto, googleReviewUrl } from '@/lib/googlePlace'
import { Alert, Avatar, Btn, Skeleton } from '@/components/UI'
import { BottomSheet } from '@/components/BottomSheet'
import { Icon } from '@/components/Icon'
import logoUrl from '@/assets/tak-logo.webp'
import { enviarCalificacionesPlatillos, fetchPlatillosPublicos, type PlatilloPublico } from '@/lib/platillos'
import { AgradecerGrupo } from '@/components/AgradecerGrupo'
import { PlatillosCalificar, faltanEstrellasPlatillos, type PlatilloElegido } from '@/components/PlatillosCalificar'

// Dock (placa NFC en mesa, barra o recepción). Según su modo:
//   resena    -> reseña del lugar (sin colaborador)
//   agradecer -> ventana plegable "¿A quién quieres agradecer?" con el equipo elegido en el panel
//   ambos     -> la ventana + "Prefiero calificar el lugar", que deja ver la reseña del lugar
// Al elegir a alguien se abre su flujo de agradecer (/tip/<liga>?d=<dock>), el mismo de la pulsera.

const translations = {
  es: {
    reviewTitle: '¿Cómo fue tu experiencia?',
    placeholder: 'Cuéntanos algo sobre tu experiencia (opcional)...',
    starLabel: (n: number) => `${n} de 5 estrellas`,
    send: 'Enviar',
    sending: 'Enviando...',
    publish: 'Publicar en Google',
    helpImprove: 'Tu comentario nos ayuda a mejorar',
    googleTitle: 'Publica tu reseña en Google en 3 pasos',
    googleSteps: ['Escribe tu comentario aquí abajo.', 'Toca «Publicar en Google»: lo copiamos por ti.', 'En Google, elige tus estrellas, mantén presionado el cuadro de texto y toca Pegar.'],
    copied: 'Tu comentario ya está copiado. En Google, mantén presionado el cuadro de texto y toca Pegar.',
    thanks: '¡Gracias por tu reseña!',
    notAvailable: 'Este punto de reseñas no está disponible',
    notAvailableSub: 'Verifica el enlace e intenta de nuevo.',
    saveError: 'No se pudo guardar tu reseña. Intenta de nuevo.',
    footer: 'Reseñas digitales por',
    hello: 'Cuéntanos de tu visita',
    tag: 'Agradecimientos que cuentan',
    dishMissing: 'Ponle estrellas a cada platillo que elegiste, o quítalo de la lista.',
    dishesThanks: (n: number) => n === 1 ? 'También guardamos la calificación de tu platillo.' : `También guardamos la calificación de tus ${n} platillos.`,
    thankWho: '¿A quién quieres agradecer?',
    thankSub: 'Toca a la persona que te atendió',
    thankSearch: 'Buscar por nombre',
    thankNone: 'Nadie coincide con la búsqueda',
    thankPick: 'Elegir a quién agradecer',
    thankToggle: 'Mostrar u ocultar el equipo',
    ratePlace: 'Prefiero calificar el lugar',
    thankLabel: (n: string) => `Agradecer a ${n}`,
    thankSub2: 'Toca a quien te atendió; puedes elegir a varias personas',
    goOne: (n: string) => `Agradecer a ${n}`,
    goMany: (n: number) => `Agradecer a ${n} personas`,
  },
  en: {
    reviewTitle: 'How was your experience?',
    placeholder: 'Tell us about your experience (optional)...',
    starLabel: (n: number) => `${n} out of 5 stars`,
    send: 'Send',
    sending: 'Sending...',
    publish: 'Post on Google',
    helpImprove: 'Your feedback helps us improve',
    googleTitle: 'Post your review on Google in 3 steps',
    googleSteps: ['Write your comment below.', 'Tap “Post on Google”: we copy it for you.', 'On Google, pick your stars, press and hold the text box and tap Paste.'],
    copied: 'Your comment is copied. On Google, press and hold the text box and tap Paste.',
    thanks: 'Thank you for your review!',
    notAvailable: 'This review point is not available',
    notAvailableSub: 'Please check the link and try again.',
    saveError: 'We could not save your review. Please try again.',
    footer: 'Digital reviews by',
    hello: 'Tell us about your visit',
    tag: 'Thanks that count',
    dishMissing: 'Give stars to each dish you picked, or remove it from the list.',
    dishesThanks: (n: number) => n === 1 ? 'We also saved your dish rating.' : `We also saved the ratings for your ${n} dishes.`,
    thankWho: 'Who would you like to thank?',
    thankSub: 'Tap the person who served you',
    thankSearch: 'Search by name',
    thankNone: 'No one matches your search',
    thankPick: 'Choose who to thank',
    thankToggle: 'Show or hide the team',
    ratePlace: 'I’d rather rate the place',
    thankLabel: (n: string) => `Thank ${n}`,
    thankSub2: 'Tap who served you; you can pick several people',
    goOne: (n: string) => `Thank ${n}`,
    goMany: (n: number) => `Thank ${n} people`,
  },
}

type Punto = {
  punto_id: string
  punto_nombre: string
  hotel_id: string
  negocio_nombre: string
  tipo: string | null
  google_place_id: string | null
  modo: 'resena' | 'agradecer' | 'ambos' | null
  pregunta: string | null
}

type Miembro = { nombre: string; puesto: string | null; foto_url: string | null; link_unico: string }

type Props = { linkId: string }

export function ResenaPage({ linkId }: Props) {
  const lang = detectLang()
  const t = translations[lang]

  const [punto, setPunto] = useState<Punto | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [starRating, setStarRating] = useState(0)
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<'plain' | 'google' | null>(null)
  const [copied, setCopied] = useState(false)
  const [platillos, setPlatillos] = useState<PlatilloPublico[]>([])
  // Orden de selección = orden en que se muestran para calificar
  const [elegidos, setElegidos] = useState<PlatilloElegido[]>([])
  const [platillosGuardados, setPlatillosGuardados] = useState(0)
  const [equipo, setEquipo] = useState<Miembro[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  // Se puede elegir a varias personas; con una sola se va a su flujo de siempre (/tip)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [grupo, setGrupo] = useState<Miembro[] | null>(null)

  useEffect(() => {
    const onPop = () => { setGrupo(null); setSheetOpen(true) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => { load() }, [linkId])

  async function load() {
    const [{ data, error: errorCarga }, menu, { data: miembros, error: errorEquipo }] = await Promise.all([
      supabase.rpc('get_punto_publico', { p_link: linkId }).maybeSingle(),
      fetchPlatillosPublicos(linkId),
      // Solo regresa gente si el dock tiene modo agradecer/ambos; si no, lista vacía
      supabase.rpc('get_colaboradores_dock', { p_link: linkId }),
    ])
    setPlatillos(menu)
    if (errorEquipo) console.error('Error cargando equipo del dock:', errorEquipo)
    if (errorCarga) console.error('Error cargando punto de reseñas:', errorCarga)
    if (errorCarga || !data) { setNotFound(true); document.title = 'tak'; return }
    const p = data as Punto
    const lista = p.modo === 'agradecer' || p.modo === 'ambos' ? ((miembros as Miembro[] | null) ?? []) : []
    setEquipo(lista)
    setPunto(p)
    document.title = lista.length ? `Agradece · ${p.negocio_nombre} · tak` : `Reseña · ${p.negocio_nombre} · tak`
    // Se abre sola, un instante después de pintar, para que se vea subir
    // ?lugar: viene de terminar de agradecer a alguien y quiere calificar el lugar; la ventana queda plegada
    const aLugar = new URLSearchParams(window.location.search).has('lugar') && p.modo === 'ambos'
    if (lista.length && !aLugar) requestAnimationFrame(() => requestAnimationFrame(() => setSheetOpen(true)))
  }

  // Sin equipo visible (modo reseña, o todos inactivos) se comporta como reseña del lugar
  const conEquipo = equipo.length > 0
  const soloAgradecer = conEquipo && punto?.modo === 'agradecer'

  function toggleMiembro(link: string) {
    setSeleccion(prev => prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link])
  }

  function continuar() {
    const elegidosEquipo = equipo.filter(m => seleccion.includes(m.link_unico))
    if (elegidosEquipo.length === 1) {
      window.location.href = `/tip/${encodeURIComponent(elegidosEquipo[0].link_unico)}?d=${encodeURIComponent(linkId)}`
    } else if (elegidosEquipo.length > 1) {
      history.pushState({ grupo: true }, '')
      setSheetOpen(false)
      setGrupo(elegidosEquipo)
      window.scrollTo(0, 0)
    }
  }

  // Google solo si el negocio tiene Place ID, la calificación es de 4-5 y el negocio aún no publicó desde este dispositivo
  const googleDisponible = !!punto?.google_place_id && starRating >= 4 && !localStorage.getItem(`tak_google_${punto?.hotel_id}`)

  const faltanEstrellas = faltanEstrellasPlatillos(elegidos)

  async function guardar(publica: boolean): Promise<boolean> {
    if (!punto) return false
    // Sin .select(): el huésped anónimo no tiene permiso de lectura sobre resenas; el id se genera aquí
    const resenaId = crypto.randomUUID()
    const { error: errorInsert } = await supabase.from('resenas').insert({
      id: resenaId,
      estrellas: starRating,
      comentario: texto.trim() || null,
      publica,
      hotel_id: punto.hotel_id,
      punto_id: punto.punto_id,
      colaborador_id: null,
    })
    if (errorInsert) {
      console.error('Error guardando reseña de dock:', errorInsert)
      setError(t.saveError)
      return false
    }
    // La reseña general ya quedó guardada; si fallan los platillos no se repite el envío
    if (elegidos.length) {
      const errorPlatillos = await enviarCalificacionesPlatillos(linkId, resenaId, elegidos.map(e => ({ platillo_id: e.id, estrellas: e.estrellas, comentario: e.comentario })))
      if (errorPlatillos) console.error('Error guardando calificaciones de platillos:', errorPlatillos)
      else setPlatillosGuardados(elegidos.length)
    }
    return true
  }

  async function handleEnviar() {
    if (!punto || starRating === 0 || saving) return
    if (faltanEstrellas) { setError(t.dishMissing); return }
    setSaving(true)
    setError('')
    const ok = await guardar(false)
    setSaving(false)
    if (ok) setDone('plain')
  }

  // Copia, abre Google y guarda en el mismo gesto del usuario. El guardado va después de window.open.
  function handlePublicarGoogle() {
    if (!punto?.google_place_id || starRating < 4 || saving) return
    if (faltanEstrellas) { setError(t.dishMissing); return }
    const value = texto.trim()
    if (value) copiarTexto(value)
    window.open(googleReviewUrl(punto.google_place_id), '_blank', 'noopener')
    setCopied(!!value)
    setSaving(true)
    setError('')
    guardar(true).then(ok => {
      setSaving(false)
      if (!ok || !punto) return
      localStorage.setItem(`tak_google_${punto.hotel_id}`, Date.now().toString())
      setDone('google')
    })
  }

  const footer = <p className="tk-gfoot">{t.footer} <strong>tak!</strong></p>

  if (notFound) return (
    <div className="tk-guest">
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /></div>
      <main className="tk-gcard">
        <div className="tk-success">
          <span className="tk-empty__mark"><Icon name="error" /></span>
          <h1 className="tk-gtitle" style={{ marginBottom: 4 }}>{t.notAvailable}</h1>
          <p className="tk-muted">{t.notAvailableSub}</p>
        </div>
        {footer}
      </main>
    </div>
  )

  if (!punto) return (
    <div className="tk-guest" aria-busy="true">
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /></div>
      <header className="tk-ghead" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Skeleton h={28} w={180} />
      </header>
      <main className="tk-gcard" style={{ gap: 12 }}>
        <Skeleton h={72} r={20} /><Skeleton h={72} r={20} />
      </main>
    </div>
  )

  const header = (
    <>
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /><span className="tk-gbar__tag">{t.tag}</span></div>
      <header className="tk-ghead">
        <div>
          <p className="tk-ghead__hello">{t.hello}</p>
          <h1 className="tk-ghead__name">{punto.negocio_nombre}</h1>
          <p className="tk-ghead__meta"><span>{punto.punto_nombre}</span></p>
        </div>
      </header>
    </>
  )

  if (done) return (
    <div className="tk-guest">
      {header}
      <main className="tk-gcard">
        <div className="tk-success" role="status">
          <span className="tk-success__mark"><Icon name="check" /></span>
          <h1 className="tk-success__title">{t.thanks}</h1>
          {platillosGuardados > 0 && <p className="tk-success__text">{t.dishesThanks(platillosGuardados)}</p>}
          {done === 'google' && copied && <Alert tone="success">{t.copied}</Alert>}
        </div>
        {footer}
      </main>
    </div>
  )

  const starPicker = (
    <div className="tk-rate" role="group" aria-label={t.reviewTitle}>
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => setStarRating(s)} className={s <= starRating ? 'is-on' : undefined}
          aria-label={t.starLabel(s)} aria-pressed={s === starRating}>
          <Icon name="star" />
        </button>
      ))}
    </div>
  )

  const q = busqueda.trim().toLowerCase()
  const visibles = q ? equipo.filter(m => `${m.nombre} ${m.puesto ?? ''}`.toLowerCase().includes(q)) : equipo

  const sheet = conEquipo && (
    <BottomSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      scrim={!soloAgradecer}
      toggleLabel={t.thankToggle}
      head={
        <>
          <h2 className="tk-sheet__title">{punto.pregunta || t.thankWho}</h2>
          <p className="tk-sheet__sub">{equipo.length > 1 ? t.thankSub2 : t.thankSub}</p>
        </>
      }
    >
      {equipo.length > 8 && (
        <label className="tk-field tk-team-search">
          <span className="tk-sr">{t.thankSearch}</span>
          <input className="tk-input" type="search" placeholder={t.thankSearch} value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </label>
      )}
      {visibles.length === 0 ? (
        <p className="tk-muted" style={{ textAlign: 'center', padding: '16px 0' }}>{t.thankNone}</p>
      ) : (
        <div className="tk-team-grid">
          {visibles.map(m => (
            <button key={m.link_unico} type="button" className="tk-team" onClick={() => toggleMiembro(m.link_unico)}
              aria-pressed={seleccion.includes(m.link_unico)} aria-label={t.thankLabel(m.nombre)}>
              <span className="tk-team__pic">
                <Avatar name={m.nombre} src={m.foto_url} size={76} />
                <span className="tk-team__check" aria-hidden="true"><Icon name="check" /></span>
              </span>
              <span className="tk-team__name">{m.nombre.toLowerCase()}</span>
              {m.puesto && <span className="tk-team__role">{m.puesto}</span>}
            </button>
          ))}
        </div>
      )}
      {seleccion.length > 0 && (
        <div className="tk-sheet__go">
          <Btn icon="tip" onClick={continuar} block>
            {seleccion.length === 1
              ? t.goOne(equipo.find(m => m.link_unico === seleccion[0])?.nombre.split(' ')[0].toLowerCase().replace(/^\p{L}/u, c => c.toUpperCase()) ?? '')
              : t.goMany(seleccion.length)}
          </Btn>
        </div>
      )}
      {!soloAgradecer && (
        <div className="tk-sheet__alt">
          <Btn variant="secondary" icon="star" onClick={() => setSheetOpen(false)}>{t.ratePlace}</Btn>
        </div>
      )}
    </BottomSheet>
  )

  if (grupo) return (
    <div className="tk-guest tk-guest--compact">
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /><span className="tk-gbar__tag">{t.tag}</span></div>
      <AgradecerGrupo
        dockLink={linkId}
        puntoId={punto.punto_id}
        miembros={grupo}
        platillos={platillos}
        conLugar={!soloAgradecer}
        onBack={() => history.back()}
        onRatePlace={() => { setGrupo(null); setSeleccion([]); setSheetOpen(false); window.scrollTo(0, 0) }}
      />
      {footer}
    </div>
  )

  // Modo "agradecer": la ventana es la página; si se pliega queda un botón para reabrirla
  if (soloAgradecer) return (
    <div className="tk-guest">
      {header}
      <main className="tk-gcard" style={{ paddingBottom: 120 }}>
        <div className="tk-success">
          <span className="tk-success__mark"><Icon name="users" /></span>
          <h2 className="tk-success__title">{punto.pregunta || t.thankWho}</h2>
          <Btn onClick={() => setSheetOpen(true)} block>{t.thankPick}</Btn>
        </div>
        {footer}
      </main>
      {sheet}
    </div>
  )

  return (
    <div className="tk-guest">
      {header}
      {sheet}
      <main className="tk-gcard" style={conEquipo ? { paddingBottom: 120 } : undefined}>
        <div>
          <h2 className="tk-gtitle">{t.reviewTitle}</h2>
          {starPicker}
          {starRating >= 4 && googleDisponible && (
            <Alert tone="success">
              <strong>{t.googleTitle}</strong>
              <ol className="tk-gsteps">{t.googleSteps.map(x => <li key={x}>{x}</li>)}</ol>
            </Alert>
          )}
          {starRating > 0 && starRating <= 3 && <Alert tone="neutral">{t.helpImprove}</Alert>}
          <label className="tk-field">
            <span className="tk-sr">{t.reviewTitle}</span>
            <textarea className="tk-textarea" placeholder={t.placeholder} value={texto} onChange={e => setTexto(e.target.value)} rows={4} />
          </label>
          <PlatillosCalificar platillos={platillos} elegidos={elegidos} marcarFaltantes={!!error}
            onChange={v => { setError(''); setElegidos(v) }} />
          {error && <Alert>{error}</Alert>}

          <div className="tk-gactions">
            {starRating > 0 && googleDisponible ? (
              <Btn variant="secondary" icon="external" onClick={handlePublicarGoogle} disabled={saving} loading={saving} block>
                {saving ? t.sending : t.publish}
              </Btn>
            ) : starRating > 0 ? (
              <Btn onClick={handleEnviar} disabled={saving} loading={saving} block>
                {saving ? t.sending : t.send}
              </Btn>
            ) : null}
          </div>
        </div>
        {footer}
      </main>
    </div>
  )
}
