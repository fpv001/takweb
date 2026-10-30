import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { detectLang } from '@/lib/utils'
import { copiarTexto, googleReviewUrl } from '@/lib/googlePlace'
import { Alert, Btn, Skeleton } from '@/components/UI'
import { Icon } from '@/components/Icon'
import logoUrl from '@/assets/tak-logo.webp'

// Reseñas de dock (placa NFC en mesa, barra o recepción): sin propina y sin colaborador

const translations = {
  es: {
    reviewTitle: '¿Cómo fue tu experiencia?',
    placeholder: 'Cuéntanos algo sobre tu experiencia (opcional)...',
    starLabel: (n: number) => `${n} de 5 estrellas`,
    send: 'Enviar',
    sending: 'Enviando...',
    publish: 'Publicar en Google',
    helpImprove: 'Tu comentario nos ayuda a mejorar',
    googlePublish: 'Tu reseña se publicará en Google',
    copied: 'Comentario copiado: pégalo en Google',
    thanks: '¡Gracias por tu reseña!',
    notAvailable: 'Este punto de reseñas no está disponible',
    notAvailableSub: 'Verifica el enlace e intenta de nuevo.',
    saveError: 'No se pudo guardar tu reseña. Intenta de nuevo.',
    footer: 'Reseñas digitales por',
    hello: 'Cuéntanos de tu visita',
    tag: 'Agradecimientos que cuentan',
  },
  en: {
    reviewTitle: 'How was your experience?',
    placeholder: 'Tell us about your experience (optional)...',
    starLabel: (n: number) => `${n} out of 5 stars`,
    send: 'Send',
    sending: 'Sending...',
    publish: 'Post on Google',
    helpImprove: 'Your feedback helps us improve',
    googlePublish: 'Your review will be posted on Google',
    copied: 'Comment copied: paste it in Google',
    thanks: 'Thank you for your review!',
    notAvailable: 'This review point is not available',
    notAvailableSub: 'Please check the link and try again.',
    saveError: 'We could not save your review. Please try again.',
    footer: 'Digital reviews by',
    hello: 'Tell us about your visit',
    tag: 'Thanks that count',
  },
}

type Punto = {
  punto_id: string
  punto_nombre: string
  hotel_id: string
  negocio_nombre: string
  tipo: string | null
  google_place_id: string | null
}

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

  useEffect(() => { load() }, [linkId])

  async function load() {
    const { data, error: errorCarga } = await supabase.rpc('get_punto_publico', { p_link: linkId }).maybeSingle()
    if (errorCarga) console.error('Error cargando punto de reseñas:', errorCarga)
    if (errorCarga || !data) { setNotFound(true); document.title = 'tak'; return }
    const p = data as Punto
    setPunto(p)
    document.title = `Reseña · ${p.negocio_nombre} · tak`
  }

  // Google solo si el negocio tiene Place ID, la calificación es de 4-5 y el negocio aún no publicó desde este dispositivo
  const googleDisponible = !!punto?.google_place_id && starRating >= 4 && !localStorage.getItem(`tak_google_${punto?.hotel_id}`)

  async function guardar(publica: boolean): Promise<boolean> {
    if (!punto) return false
    // Sin .select(): el huésped anónimo no tiene permiso de lectura sobre resenas
    const { error: errorInsert } = await supabase.from('resenas').insert({
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
    return true
  }

  async function handleEnviar() {
    if (!punto || starRating === 0 || saving) return
    setSaving(true)
    setError('')
    const ok = await guardar(false)
    setSaving(false)
    if (ok) setDone('plain')
  }

  // Copia, abre Google y guarda en el mismo gesto del usuario. El guardado va después de window.open.
  function handlePublicarGoogle() {
    if (!punto?.google_place_id || starRating < 4 || saving) return
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

  return (
    <div className="tk-guest">
      {header}
      <main className="tk-gcard">
        <div>
          <h2 className="tk-gtitle">{t.reviewTitle}</h2>
          {starPicker}
          {starRating >= 4 && googleDisponible && <Alert tone="success">{t.googlePublish}</Alert>}
          {starRating > 0 && starRating <= 3 && <Alert tone="neutral">{t.helpImprove}</Alert>}
          <label className="tk-field">
            <span className="tk-sr">{t.reviewTitle}</span>
            <textarea className="tk-textarea" placeholder={t.placeholder} value={texto} onChange={e => setTexto(e.target.value)} rows={4} />
          </label>
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
