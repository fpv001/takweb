import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getInitials, formatMXN, detectLang } from '@/lib/utils'
import { Alert, Avatar, Btn, Skeleton } from '@/components/UI'
import { Icon, type IconName } from '@/components/Icon'
import logoUrl from '@/assets/tak-logo.webp'

const SUGGESTED_AMOUNTS = [50, 100, 200]
type Step = 'landing' | 'review' | 'tip' | 'comment' | 'success'

const translations = {
  es: {
    labelAmount: '¿Cuánto deseas dejar?',
    labelOr: 'o paga con',
    labelReview: '¿Cómo fue tu experiencia?',
    reviewPlaceholder: 'Cuéntanos algo sobre tu experiencia...',
    customPlaceholder: 'Otro monto',
    payBtn: (amt: number) => `Pagar ${formatMXN(amt)}`,
    payBtnSelect: 'Selecciona un monto',
    successTitle: '¡Gracias!',
    successTip: (name: string) => `Tu propina llegó a ${name}. ¡Que tengas un excelente día!`,
    successReview: '¡Gracias por tu reseña!',
    successComment: (name: string) => `Tu mensaje fue enviado a ${name}`,
    errorTitle: 'Colaborador no encontrado',
    errorSub: 'Verifica el enlace e intenta de nuevo.',
    footer: 'Propinas digitales por',
    paymentDetails: 'Datos de pago',
    cardName: 'Nombre en la tarjeta',
    cardNumber: 'Número de tarjeta',
    reviewTip: 'Reseña + propina',
    reviewTipDesc: 'Califica su servicio y agradécele',
    tipOnly: 'Solo propina',
    tipOnlyDesc: 'Rápido y directo',
    commentOnly: 'Dejar un mensaje',
    commentOnlyDesc: 'Sin pago, solo unas palabras',
    alreadyReviewed: 'Ya dejaste una reseña anteriormente. ¿Quieres dejar otra propina?',
    reviewTitle: '¿Cómo fue tu experiencia?',
    googlePublish: '¡Tu reseña será publicada en Google!',
    googleButton: 'Publicar en Google',
    helpImprove: 'Tu comentario nos ayuda a mejorar',
    tipButton: 'Continuar a la propina',
    skipTipButton: 'Enviar sin propina',
    back: 'Volver',
    commentTitle: (name: string) => `Déjale un mensaje a ${name}`,
    commentPlaceholder: 'Cuéntale algo que te haya gustado o sugerencias de mejora...',
    thankYou: '¡Gracias!',
    commentReceived: 'Tu mensaje fue entregado. Nos ayuda a mejorar.',
    processing: 'Procesando...',
    quickRating: 'Califica tu experiencia (opcional)',
    continueBtn: 'Enviar mensaje',
    cardExpiry: 'Vencimiento',
    cardCvc: 'CVC',
    starLabel: (n: number) => `${n} de 5 estrellas`,
  },
  en: {
    labelAmount: 'How much would you like to leave?',
    labelOr: 'or pay with',
    labelReview: 'How was your experience?',
    reviewPlaceholder: 'Tell us about your experience...',
    customPlaceholder: 'Custom amount',
    payBtn: (amt: number) => `Pay ${formatMXN(amt)}`,
    payBtnSelect: 'Select an amount',
    successTitle: 'Thank you!',
    successTip: (name: string) => `Your tip was sent to ${name}. Have a wonderful day!`,
    successReview: 'Thank you for your review!',
    successComment: (name: string) => `Your message was sent to ${name}`,
    errorTitle: 'Staff member not found',
    errorSub: 'Please check the link and try again.',
    footer: 'Digital tips by',
    paymentDetails: 'Payment details',
    cardName: 'Cardholder name',
    cardNumber: 'Card number',
    reviewTip: 'Review + tip',
    reviewTipDesc: 'Rate their service and say thanks',
    tipOnly: 'Tip only',
    tipOnlyDesc: 'Quick and simple',
    commentOnly: 'Leave a message',
    commentOnlyDesc: 'No payment, just a few words',
    alreadyReviewed: 'You already left a review. Want to tip again?',
    reviewTitle: 'How was your experience?',
    googlePublish: 'Your review will be shared on Google!',
    googleButton: 'Post on Google',
    helpImprove: 'Your feedback helps us improve',
    tipButton: 'Continue to tip',
    skipTipButton: 'Send without a tip',
    back: 'Back',
    commentTitle: (name: string) => `Leave a message for ${name}`,
    commentPlaceholder: 'Tell them something you liked or suggestions for improvement...',
    thankYou: 'Thank you!',
    commentReceived: 'Your message was delivered. It helps us improve.',
    processing: 'Processing...',
    quickRating: 'Rate your experience (optional)',
    continueBtn: 'Send message',
    cardExpiry: 'Expiry',
    cardCvc: 'CVC',
    starLabel: (n: number) => `${n} out of 5 stars`,
  },
}

type Hotel = { id: string; nombre: string; stripe_api_key: string | null; google_place_id: string | null }
type Colaborador = {
  id: string; nombre: string; puesto: string | null
  foto_url: string | null; hotel_id: string
}

type Props = { linkId: string }

export function TipPage({ linkId }: Props) {
  const lang = detectLang()
  const t = translations[lang]

  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState<Step>('landing')
  const [hasVisited, setHasVisited] = useState(false)

  const [selectedAmount, setSelectedAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState('')
  const [starRating, setStarRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [commentText, setCommentText] = useState('')
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null)
  const [cameFromReview, setCameFromReview] = useState(false)
  const [successType, setSuccessType] = useState<'tip' | 'comment' | 'review'>('tip')
  const [googleOpened, setGoogleOpened] = useState(false)

  useEffect(() => { loadColaborador() }, [linkId])

  useEffect(() => {
    const visited = localStorage.getItem(`tak_visited_${linkId}`)
    setHasVisited(!!visited)
  }, [linkId])

  async function loadColaborador() {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .eq('link_unico', linkId)
      .eq('activo', true)
      .single()

    if (error || !data) { setNotFound(true); document.title = 'tak'; return }
    setColaborador(data as Colaborador)
    document.title = `Deja una propina a ${data.nombre} · tak`

    const { data: hotelData, error: hotelError } = await supabase
      .from('hotels')
      .select('id, nombre, stripe_api_key, google_place_id')
      .eq('id', data.hotel_id)
      .maybeSingle()

    console.log('Hotel query result:', { hotelData, hotelError, hotel_id: data.hotel_id })
    if (hotelData) setHotel(hotelData)
  }

  const displayAmount = customAmount ? parseFloat(customAmount) : selectedAmount

  async function createTip(reviewIdToUpdate?: string | null) {
    if (!displayAmount || !colaborador) return
    try {
      const tipData = {
        hotel_id: colaborador.hotel_id,
        colaborador_id: colaborador.id,
        monto_total: displayAmount,
        stripe_payment_id: `manual_${Date.now()}`,
        estado: 'completado',
      }
      console.log('Tip data:', tipData)

      const { data: propina, error } = await supabase
        .from('propinas')
        .insert(tipData)
        .select().single()

      if (error) throw error

      await supabase.from('repartos').insert({
        propina_id: propina.id,
        colaborador_id: colaborador.id,
        monto: displayAmount,
        estado: 'pendiente',
      })

      if (reviewIdToUpdate) {
        await supabase
          .from('resenas')
          .update({ propina_id: propina.id })
          .eq('id', reviewIdToUpdate)
      }

      return propina.id
    } catch (err) {
      console.error('Error creating tip:', err)
      return null
    }
  }

  async function handleOpenGoogleReviews() {
    if (!hotel?.google_place_id || starRating < 4) return
    try {
      if (reviewText.trim()) {
        await navigator.clipboard.writeText(reviewText)
      }
      localStorage.setItem(`tak_google_${hotel.id}`, Date.now().toString())
      localStorage.setItem(`tak_visited_${linkId}`, Date.now().toString())
      setGoogleOpened(true)
      window.open(`https://search.google.com/local/writereview?placeid=${hotel.google_place_id}`, '_blank')
    } catch (err) {
      console.error('Error opening Google Reviews:', err)
    }
  }

  async function handleReviewWithoutTip() {
    if (!colaborador || starRating === 0) return
    setLoading(true)
    try {
      await supabase.from('resenas').insert({
        estrellas: starRating,
        comentario: reviewText.trim() || null,
        publica: starRating >= 4,
      })
    } catch (err) {
      console.error('Error saving review:', err)
    } finally {
      localStorage.setItem(`tak_visited_${linkId}`, Date.now().toString())
      setSuccessMessage(lang === 'es' ? '¡Gracias por tu reseña!' : 'Thank you for your review!')
      setSuccessType('review')
      setStep('success')
      setLoading(false)
    }
  }

  async function handleReviewWithTip() {
    if (!colaborador || starRating === 0) return
    setLoading(true)
    try {
      const { data: resena, error } = await supabase
        .from('resenas')
        .insert({
          estrellas: starRating,
          comentario: reviewText.trim() || null,
          publica: starRating >= 4,
        })
        .select().single()

      if (error) throw error

      setPendingReviewId(resena.id)
      setCameFromReview(true)
    } catch (err) {
      console.error('Error saving review:', err)
    } finally {
      localStorage.setItem(`tak_visited_${linkId}`, Date.now().toString())
      setStep('tip')
      setLoading(false)
    }
  }


  async function handleQuickRating() {
    if (!colaborador || starRating === 0) return
    try {
      await supabase.from('resenas').insert({
        estrellas: starRating,
        comentario: null,
        publica: false,
      })
      setStarRating(0)
    } catch (err) {
      console.error('Error saving quick rating:', err)
    }
  }

  async function handleTipSubmit() {
    if (!displayAmount || !colaborador) return
    setLoading(true)
    try {
      const propinavId = await createTip(pendingReviewId || undefined)
      if (!propinavId) throw new Error('Tip creation failed')

      if (!cameFromReview && starRating > 0) {
        await handleQuickRating()
      }

      localStorage.setItem(`tak_visited_${linkId}`, Date.now().toString())
      setSuccessMessage((t.successTip as (name: string) => string)(colaborador.nombre))
      setSuccessType('tip')
      setStep('success')
    } catch (err) {
      console.error('Error in handleTipSubmit:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCommentSubmit() {
    if (!colaborador || !commentText.trim()) return
    setLoading(true)
    try {
      await supabase.from('resenas').insert({
        estrellas: null,
        comentario: commentText.trim(),
        publica: false,
      })
    } catch (err) {
      console.error('Error saving comment:', err)
    } finally {
      localStorage.setItem(`tak_visited_${linkId}`, Date.now().toString())
      setSuccessMessage((t.successComment as (name: string) => string)(colaborador.nombre))
      setSuccessType('comment')
      setStep('success')
      setLoading(false)
    }
  }

  function goBack() {
    if (step === 'landing') return
    if (step === 'tip' && cameFromReview) {
      setStep('review')
      setCameFromReview(false)
    } else {
      setStep('landing')
      setStarRating(0)
      setReviewText('')
      setCommentText('')
      setSelectedAmount(0)
      setCustomAmount('')
      setPendingReviewId(null)
    }
  }

  const header = colaborador && (
    <>
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /></div>
      <header className="tk-ghead">
        <Avatar name={colaborador.nombre} src={colaborador.foto_url} size={88} />
        <h1 className="tk-ghead__name">{colaborador.nombre}</h1>
        <p className="tk-ghead__meta"><span>{[colaborador.puesto, hotel?.nombre].filter(Boolean).join(' · ')}</span></p>
      </header>
    </>
  )

  const footer = <p className="tk-gfoot">{t.footer} <strong>tak!</strong></p>

  if (notFound) return (
    <div className="tk-guest">
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /></div>
      <main className="tk-gcard">
        <div className="tk-success">
          <span className="tk-empty__mark"><Icon name="error" /></span>
          <h1 className="tk-gtitle" style={{ marginBottom: 4 }}>{t.errorTitle}</h1>
          <p className="tk-muted">{t.errorSub}</p>
        </div>
        {footer}
      </main>
    </div>
  )

  if (!colaborador) return (
    <div className="tk-guest" aria-busy="true">
      <div className="tk-gbar"><img src={logoUrl} alt="tak!" /></div>
      <header className="tk-ghead" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Skeleton h={88} w={88} r={999} />
        <Skeleton h={28} w={180} />
      </header>
      <main className="tk-gcard" style={{ gap: 12 }}>
        <Skeleton h={72} r={20} /><Skeleton h={72} r={20} /><Skeleton h={72} r={20} />
      </main>
    </div>
  )

  if (step === 'success') return (
    <div className="tk-guest">
      {header}
      <main className="tk-gcard">
        <div className="tk-success" role="status">
          <span className="tk-success__mark"><Icon name="check" /></span>
          <h1 className="tk-success__title">
            {successType === 'comment' ? t.thankYou : successType === 'review' ? (lang === 'es' ? '¡Gracias!' : 'Thank you!') : t.thankYou}
          </h1>
          <p className="tk-success__text">{successMessage}</p>
        </div>
        {footer}
      </main>
    </div>
  )

  const backBtn = step !== 'landing' ? (
    <Btn variant="text" icon="back" onClick={goBack}>{t.back}</Btn>
  ) : null

  const starPicker = (small?: boolean) => (
    <div className={`tk-rate${small ? ' tk-rate--sm' : ''}`} role="group" aria-label={t.reviewTitle}>
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => setStarRating(s)} className={s <= starRating ? 'is-on' : undefined}
          aria-label={(t.starLabel as (n: number) => string)(s)} aria-pressed={s === starRating}>
          <Icon name="star" />
        </button>
      ))}
    </div>
  )

  const option = (onClick: () => void, icon: IconName, title: string, desc: string, featured: boolean) => (
    <button type="button" onClick={onClick} className="tk-option" data-featured={featured || undefined}>
      <span className="tk-option__icon"><Icon name={icon} /></span>
      <span>
        <span className="tk-option__title">{title}</span>
        <span className="tk-option__desc">{desc}</span>
      </span>
      <Icon name="chevronRight" className="tk-chevron" />
    </button>
  )

  return (
    <div className="tk-guest">

      {header}

      <main className="tk-gcard">

        {backBtn}

        {step === 'landing' && (
          <div>
            {hasVisited && <p className="tk-gnote">{t.alreadyReviewed}</p>}
            <div className="tk-options">
              {!hasVisited && option(() => setStep('review'), 'star', t.reviewTip, t.reviewTipDesc, true)}
              {option(() => setStep('tip'), 'tip', t.tipOnly, t.tipOnlyDesc, hasVisited)}
              {option(() => setStep('comment'), 'message', t.commentOnly, t.commentOnlyDesc, false)}
            </div>
          </div>
        )}

        {step === 'review' && (() => {
          console.log('Review step render:', { starRating, googleOpened, hotel_id: hotel?.id, google_place_id: hotel?.google_place_id, hasGoogleKey: !!localStorage.getItem(`tak_google_${hotel?.id}`) })
          return (
          <div>
            <h2 className="tk-gtitle">{t.reviewTitle}</h2>
            {starPicker()}
            {starRating >= 4 && <Alert tone="success">{t.googlePublish}</Alert>}
            {starRating > 0 && starRating <= 3 && <Alert tone="neutral">{t.helpImprove}</Alert>}
            <label className="tk-field">
              <span className="tk-sr">{t.labelReview}</span>
              <textarea className="tk-textarea" placeholder={t.reviewPlaceholder} value={reviewText} onChange={e => setReviewText(e.target.value)} rows={4} />
            </label>

            <div className="tk-gactions">
              {(() => {
                console.log('Google button condition:', {
                  starRating,
                  googleOpened,
                  google_place_id: hotel?.google_place_id,
                  tak_google_exists: !!localStorage.getItem(`tak_google_${hotel?.id}`),
                  hotel_id: hotel?.id
                })
                return null
              })()}

              {starRating >= 4 && !googleOpened && hotel?.google_place_id && !localStorage.getItem(`tak_google_${hotel?.id}`) && (
                <Btn variant="secondary" icon="external" onClick={handleOpenGoogleReviews} disabled={loading} block>
                  {(t.googleButton as string)}
                </Btn>
              )}

              {starRating > 0 && (starRating <= 3 || googleOpened || !hotel?.google_place_id || localStorage.getItem(`tak_google_${hotel?.id}`)) && (
                <>
                  <Btn icon={loading ? undefined : 'tip'} onClick={handleReviewWithTip} disabled={loading} loading={loading} block>
                    {loading ? t.processing : (t.tipButton as string)}
                  </Btn>
                  <Btn variant="secondary" onClick={handleReviewWithoutTip} disabled={loading} block>
                    {loading ? t.processing : (t.skipTipButton as string)}
                  </Btn>
                </>
              )}
            </div>
          </div>
          )
        })()}

        {step === 'tip' && (
          <div>
            {!cameFromReview && (
              <div className="tk-panel">
                <p className="tk-glabel">{t.quickRating}</p>
                {starPicker(true)}
              </div>
            )}
            <p className="tk-glabel" id="amount-label">{t.labelAmount}</p>
            <div className="tk-amounts" role="group" aria-labelledby="amount-label">
              {SUGGESTED_AMOUNTS.map(a => (
                <button key={a} type="button" className="tk-amount" aria-pressed={selectedAmount === a && !customAmount} onClick={() => { setSelectedAmount(a); setCustomAmount('') }}>
                  <span className="tk-amount__value">${a}</span>
                  <span className="tk-amount__cur">MXN</span>
                </button>
              ))}
            </div>

            <label className="tk-field" style={{ marginBottom: 24 }}>
              <span className="tk-sr">{t.customPlaceholder}</span>
              <span className="tk-input-wrap">
                <input className="tk-input" type="number" inputMode="decimal" placeholder={t.customPlaceholder} value={customAmount}
                  onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0) }} style={{ paddingRight: 64 }} />
                <span className="tk-input-wrap__suffix">MXN</span>
              </span>
            </label>

            <p className="tk-glabel" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="card" size={18} />{t.paymentDetails}</p>
            <label className="tk-field">
              <span className="tk-field__label" style={{ fontWeight: 400 }}>{t.cardName}</span>
              <input className="tk-input" type="text" autoComplete="cc-name" value={cardName} onChange={e => setCardName(e.target.value)} />
            </label>
            <label className="tk-field">
              <span className="tk-field__label" style={{ fontWeight: 400 }}>{t.cardNumber}</span>
              <input className="tk-input tk-num" type="text" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(e.target.value)} maxLength={19} />
            </label>
            <div className="tk-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="tk-field">
                <span className="tk-field__label" style={{ fontWeight: 400 }}>{t.cardExpiry}</span>
                <input className="tk-input tk-num" type="text" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} maxLength={5} />
              </label>
              <label className="tk-field">
                <span className="tk-field__label" style={{ fontWeight: 400 }}>{t.cardCvc}</span>
                <input className="tk-input tk-num" type="text" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={cardCvc} onChange={e => setCardCvc(e.target.value)} maxLength={4} />
              </label>
            </div>

            <div className="tk-divider">{t.labelOr}</div>
            <div className="tk-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['Apple Pay','Google Pay'].map(w => (
                <Btn key={w} variant="secondary" block>{w}</Btn>
              ))}
            </div>

            <div className="tk-paybar">
              <Btn onClick={handleTipSubmit} disabled={!displayAmount || loading} loading={loading} block>
                {loading ? t.processing : displayAmount ? (t.payBtn as (amt: number) => string)(displayAmount) : t.payBtnSelect}
              </Btn>
            </div>
          </div>
        )}

        {step === 'comment' && (
          <div>
            <h2 className="tk-gtitle">{(t.commentTitle as (name: string) => string)(colaborador.nombre)}</h2>
            <label className="tk-field">
              <span className="tk-sr">{(t.commentTitle as (name: string) => string)(colaborador.nombre)}</span>
              <textarea className="tk-textarea" placeholder={t.commentPlaceholder} value={commentText} onChange={e => setCommentText(e.target.value)} rows={5} />
            </label>
            <Btn icon={loading ? undefined : 'message'} onClick={handleCommentSubmit} disabled={!commentText.trim() || loading} loading={loading} block>
              {loading ? t.processing : t.continueBtn}
            </Btn>
          </div>
        )}

        {step !== 'landing' && step !== 'comment' && step !== 'tip' && step !== 'review' ? null : footer}
      </main>
    </div>
  )
}
