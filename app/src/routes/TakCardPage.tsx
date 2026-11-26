import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { detectLang } from '@/lib/utils'
import { copiarTexto, googleReviewUrl } from '@/lib/googlePlace'
import { Alert, Avatar, Btn, Skeleton } from '@/components/UI'
import { Icon, type IconName } from '@/components/Icon'
import logoUrl from '@/assets/tak-logo.webp'

// Pulsera tak! de un admin (/k/<codigo>): linktree "Conoce tak!".
//   Conoce tak!          -> landing (tak_config.conoce_url)
//   Deja una reseña      -> estrellas + comentario; 4-5 estrellas y Place ID -> Google con el texto copiado
//   Ver video            -> elige Dock o Pulsera y se reproduce aquí mismo (app/public/videos)
// Cada toque se registra por pulsera (registrar_tak_evento) para medir a cada admin.

const translations = {
  es: {
    presents: 'Te lo presenta',
    tag: 'Agradecimientos que cuentan',
    title: 'Conoce tak!',
    conoce: 'Conoce tak!',
    conoceDesc: 'Reseñas y propinas digitales para tu negocio',
    resena: 'Deja una reseña a tak!',
    resenaDesc: 'Cuéntanos qué te pareció',
    video: 'Ver video',
    videoDesc: 'Dock y pulsera tak!',
    videoPick: '¿Qué quieres ver?',
    dock: 'Dock tak!',
    dockDesc: 'Propinas y reseñas desde el mostrador',
    pulsera: 'Pulsera tak!',
    pulseraDesc: 'Propinas y reseñas con un toque',
    soon: 'Próximamente',
    back: 'Volver',
    reviewTitle: '¿Qué te pareció tak!?',
    placeholder: 'Cuéntanos qué te pareció (opcional)...',
    starLabel: (n: number) => `${n} de 5 estrellas`,
    send: 'Enviar',
    sending: 'Enviando...',
    publish: 'Publicar en Google',
    googleTitle: 'Publica tu reseña en Google en 3 pasos',
    googleSteps: ['Escribe tu comentario aquí abajo.', 'Toca «Publicar en Google»: lo copiamos por ti.', 'En Google, elige tus estrellas, mantén presionado el cuadro de texto y toca Pegar.'],
    helpImprove: 'Tu comentario nos ayuda a mejorar',
    copied: 'Tu comentario ya está copiado. En Google, mantén presionado el cuadro de texto y toca Pegar.',
    thanks: '¡Gracias por tu reseña!',
    thanksSub: 'Nos ayuda muchísimo a seguir creciendo.',
    saveError: 'No se pudo guardar tu reseña. Intenta de nuevo.',
    notAvailable: 'Esta pulsera no está disponible',
    notAvailableSub: 'Pero puedes conocer tak! aquí abajo.',
    footer: 'Hecho con',
  },
  en: {
    presents: 'Presented by',
    tag: 'Thanks that count',
    title: 'Meet tak!',
    conoce: 'Meet tak!',
    conoceDesc: 'Digital reviews and tips for your business',
    resena: 'Leave tak! a review',
    resenaDesc: 'Tell us what you think',
    video: 'Watch the video',
    videoDesc: 'tak! dock and wristband',
    videoPick: 'What would you like to see?',
    dock: 'tak! Dock',
    dockDesc: 'Tips and reviews from the counter',
    pulsera: 'tak! Wristband',
    pulseraDesc: 'Tips and reviews with one tap',
    soon: 'Coming soon',
    back: 'Back',
    reviewTitle: 'What did you think of tak!?',
    placeholder: 'Tell us what you think (optional)...',
    starLabel: (n: number) => `${n} out of 5 stars`,
    send: 'Send',
    sending: 'Sending...',
    publish: 'Post on Google',
    googleTitle: 'Post your review on Google in 3 steps',
    googleSteps: ['Write your comment below.', 'Tap “Post on Google”: we copy it for you.', 'On Google, pick your stars, press and hold the text box and tap Paste.'],
    helpImprove: 'Your feedback helps us improve',
    copied: 'Your comment is copied. On Google, press and hold the text box and tap Paste.',
    thanks: 'Thank you for your review!',
    thanksSub: 'It really helps us keep growing.',
    saveError: 'We could not save your review. Please try again.',
    notAvailable: 'This wristband is not available',
    notAvailableSub: 'But you can still meet tak! below.',
    footer: 'Made with',
  },
}

type Tarjeta = { nombre: string; foto_url: string | null; google_place_id: string | null; video_url: string | null; conoce_url: string }
type Evento = 'abrir' | 'conoce' | 'resena' | 'video' | 'google'
type Video = 'dock' | 'pulsera'

const videoSrc = (v: Video, ext: 'mp4' | 'jpg') => `${import.meta.env.BASE_URL}videos/tak-${v}.${ext}`

const GOOGLE_KEY = 'tak_google_tak'

// Solo se aceptan ligas http(s) o rutas del mismo sitio (nada de javascript:)
function urlSegura(url: string | null | undefined, fallback: string | null = null) {
  if (!url) return fallback
  if (url.startsWith('/') && !url.startsWith('//')) return url
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : fallback } catch { return fallback }
}

export function TakCardPage({ codigo }: { codigo: string }) {
  const lang = detectLang()
  const t = translations[lang]

  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [vista, setVista] = useState<'menu' | 'resena' | 'done' | 'video'>('menu')
  const [estrellas, setEstrellas] = useState(0)
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [video, setVideo] = useState<Video | null>(null)

  useEffect(() => { cargar() }, [codigo])

  function registrar(tipo: Evento) {
    return supabase.rpc('registrar_tak_evento', { p_codigo: codigo, p_tipo: tipo })
      .then(({ error: e }) => { if (e) console.error('Error registrando evento tak!:', e) })
  }

  async function cargar() {
    const { data, error: e } = await supabase.rpc('get_tak_tarjeta_publica', { p_codigo: codigo }).maybeSingle()
    if (e) console.error('Error cargando pulsera tak!:', e)
    if (e || !data) { setNotFound(true); document.title = 'tak!'; return }
    setTarjeta(data as Tarjeta)
    document.title = `${t.title} · tak!`
    // Un toque por sesión del navegador: recargar la página no infla el número
    try {
      const k = `tak_k_${codigo}`
      if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); registrar('abrir') }
    } catch { registrar('abrir') }
  }

  const conoceUrl = urlSegura(tarjeta?.conoce_url, '/') ?? '/'

  // Misma pestaña: espera al registro un instante (máx. 600 ms) para que no se pierda al navegar
  async function irAConoce() {
    await Promise.race([registrar('conoce'), new Promise(r => setTimeout(r, 600))])
    window.location.href = conoceUrl
  }

  function abrirVideo() {
    setVista('video')
    registrar('video')
  }

  function abrirResena() {
    setVista('resena')
    registrar('resena')
  }

  let yaPublico = false
  try { yaPublico = !!localStorage.getItem(GOOGLE_KEY) } catch { /* sin almacenamiento */ }
  const googleDisponible = !!tarjeta?.google_place_id && estrellas >= 4 && !yaPublico

  async function guardar(publica: boolean) {
    const { error: e } = await supabase.rpc('registrar_tak_resena', {
      p_codigo: codigo, p_estrellas: estrellas, p_comentario: texto.trim() || null, p_publica: publica,
    })
    if (e) { console.error('Error guardando reseña tak!:', e); setError(t.saveError); return false }
    return true
  }

  async function enviar() {
    if (estrellas === 0 || saving) return
    setSaving(true); setError('')
    const ok = await guardar(false)
    setSaving(false)
    if (ok) setVista('done')
  }

  // Copia y abre Google en el mismo gesto (iOS bloquea window.open después de un await); luego guarda
  function publicarGoogle() {
    if (!tarjeta?.google_place_id || estrellas < 4 || saving) return
    const value = texto.trim()
    if (value) copiarTexto(value)
    window.open(googleReviewUrl(tarjeta.google_place_id), '_blank', 'noopener')
    setCopied(!!value)
    setSaving(true); setError('')
    registrar('google')
    guardar(true).then(ok => {
      setSaving(false)
      if (!ok) return
      try { localStorage.setItem(GOOGLE_KEY, Date.now().toString()) } catch { /* sin almacenamiento */ }
      setVista('done')
    })
  }

  const footer = <p className="tk-gfoot">{t.footer} <strong>tak!</strong></p>
  const bar = <div className="tk-gbar"><img src={logoUrl} alt="tak!" /><span className="tk-gbar__tag">{t.tag}</span></div>

  const option = (onClick: (() => void) | undefined, icon: IconName, title: string, desc: string, featured = false, disabled = false) => (
    <button type="button" onClick={onClick} className="tk-option" data-featured={featured || undefined}
      disabled={disabled} aria-disabled={disabled || undefined}>
      <span className="tk-option__icon"><Icon name={icon} /></span>
      <span>
        <span className="tk-option__title">{title}</span>
        <span className="tk-option__desc">{desc}</span>
      </span>
      {disabled ? <span className="tk-soon">{t.soon}</span> : <Icon name="chevronRight" className="tk-chevron" />}
    </button>
  )

  if (notFound) return (
    <div className="tk-guest">
      {bar}
      <header className="tk-ghead"><h1 className="tk-ghead__name">{t.title}</h1></header>
      <main className="tk-gcard">
        <div className="tk-success" style={{ flex: 'none', paddingBottom: 'var(--s-6)' }}>
          <h2 className="tk-gtitle" style={{ marginBottom: 4 }}>{t.notAvailable}</h2>
          <p className="tk-muted">{t.notAvailableSub}</p>
        </div>
        <div className="tk-options">
          {option(() => { window.location.href = '/' }, 'heart', t.conoce, t.conoceDesc, true)}
        </div>
        {footer}
      </main>
    </div>
  )

  if (!tarjeta) return (
    <div className="tk-guest" aria-busy="true">
      {bar}
      <header className="tk-ghead" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Skeleton h={96} w={96} r={48} /><Skeleton h={28} w={180} />
      </header>
      <main className="tk-gcard" style={{ gap: 12 }}>
        <Skeleton h={72} r={18} /><Skeleton h={72} r={18} /><Skeleton h={72} r={18} />
      </main>
    </div>
  )

  const header = (
    <header className="tk-ghead">
      <Avatar name={tarjeta.nombre} src={tarjeta.foto_url} size={96} />
      <p className="tk-ghead__hello">{t.presents}</p>
      <h1 className="tk-ghead__name">{tarjeta.nombre}</h1>
    </header>
  )

  if (vista === 'done') return (
    <div className="tk-guest">
      {bar}
      {header}
      <main className="tk-gcard">
        <div className="tk-success" role="status">
          <span className="tk-success__mark"><Icon name="check" /></span>
          <h2 className="tk-success__title">{t.thanks}</h2>
          <p className="tk-success__text">{t.thanksSub}</p>
          {copied && <Alert tone="success">{t.copied}</Alert>}
        </div>
        <div className="tk-options">
          {option(irAConoce, 'heart', t.conoce, t.conoceDesc, true)}
        </div>
        {footer}
      </main>
    </div>
  )

  if (vista === 'video') return (
    <div className="tk-guest tk-guest--compact">
      {bar}
      {header}
      <main className="tk-gcard">
        <Btn variant="text" icon="back" onClick={() => { if (video) setVideo(null); else setVista('menu') }}>{t.back}</Btn>
        {video ? (
          <>
            <h2 className="tk-gtitle">{t[video]}</h2>
            <video key={video} className="tk-video" src={videoSrc(video, 'mp4')} poster={videoSrc(video, 'jpg')}
              controls autoPlay playsInline preload="metadata" />
          </>
        ) : (
          <>
            <h2 className="tk-gtitle">{t.videoPick}</h2>
            <div className="tk-options">
              {option(() => setVideo('dock'), 'play', t.dock, t.dockDesc)}
              {option(() => setVideo('pulsera'), 'play', t.pulsera, t.pulseraDesc)}
            </div>
          </>
        )}
        {footer}
      </main>
    </div>
  )

  if (vista === 'resena') return (
    <div className="tk-guest tk-guest--compact">
      {bar}
      {header}
      <main className="tk-gcard">
        <Btn variant="text" icon="back" onClick={() => { setVista('menu'); setError('') }}>{t.back}</Btn>
        <h2 className="tk-gtitle">{t.reviewTitle}</h2>
        <div className="tk-rate" role="group" aria-label={t.reviewTitle}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} type="button" onClick={() => setEstrellas(s)} className={s <= estrellas ? 'is-on' : undefined}
              aria-label={t.starLabel(s)} aria-pressed={s === estrellas}>
              <Icon name="star" />
            </button>
          ))}
        </div>
        {googleDisponible && (
          <Alert tone="success">
            <strong>{t.googleTitle}</strong>
            <ol className="tk-gsteps">{t.googleSteps.map(x => <li key={x}>{x}</li>)}</ol>
          </Alert>
        )}
        {estrellas > 0 && estrellas <= 3 && <Alert tone="neutral">{t.helpImprove}</Alert>}
        <label className="tk-field">
          <span className="tk-sr">{t.reviewTitle}</span>
          <textarea className="tk-textarea" placeholder={t.placeholder} value={texto} maxLength={1000}
            onChange={e => setTexto(e.target.value)} rows={4} />
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="tk-gactions">
          {estrellas > 0 && googleDisponible ? (
            <Btn variant="secondary" icon="external" onClick={publicarGoogle} disabled={saving} loading={saving} block>
              {saving ? t.sending : t.publish}
            </Btn>
          ) : estrellas > 0 ? (
            <Btn onClick={enviar} disabled={saving} loading={saving} block>{saving ? t.sending : t.send}</Btn>
          ) : null}
        </div>
        {footer}
      </main>
    </div>
  )

  return (
    <div className="tk-guest">
      {bar}
      {header}
      <main className="tk-gcard">
        <div className="tk-options">
          {option(irAConoce, 'heart', t.conoce, t.conoceDesc, true)}
          {option(abrirResena, 'star', t.resena, t.resenaDesc)}
          {option(abrirVideo, 'play', t.video, t.videoDesc)}
        </div>
        {footer}
      </main>
    </div>
  )
}
