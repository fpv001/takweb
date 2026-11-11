import { useEffect, useRef, useState } from 'react'
import { animate, createScope, createTimeline, stagger, type Scope } from 'animejs'
import { useAuth } from '@/context/AuthContext'
import { Alert, Btn } from '@/components/UI'
import { TakLogo } from '@/components/TakLogo'
import { loadColaborador, loadHotel } from '@/routes/loaders'

// El logo de la pantalla de arranque mide 1.25× el del login (ver .tk-launch__logo)
const LAUNCH_SCALE = 1.25

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const scope = useRef<Scope | null>(null)
  const quieto = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Entrada continua desde la pantalla de arranque: el logo viaja del centro a su lugar,
  // la hoja sube firme y el "toque" emite una sola onda. Sin rebotes: se siente app, no web.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    idle(() => { loadColaborador(); loadHotel() })
    if (quieto || !root.current) return
    const mark = root.current.querySelector<HTMLElement>('.tk-auth__mark')!
    const r = mark.getBoundingClientRect()
    const dx = window.innerWidth / 2 - (r.left + r.width / 2)
    const dy = window.innerHeight / 2 - (r.top + r.height / 2)
    scope.current = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: 'outExpo' } })
        .add('.tk-auth__mark', { x: { from: dx }, y: { from: dy }, scale: { from: LAUNCH_SCALE }, duration: 760 }, 0)
        .add('.tk-auth__form', { y: { from: '100%' }, duration: 620 }, 140)
        .add('.tk-auth__form > *', { y: { from: 10 }, opacity: { from: 0 }, duration: 380, delay: stagger(35), ease: 'outQuad' }, 300)
        .add('.tk-auth__ripple i', { scale: { from: .2, to: 1 }, opacity: { from: .55, to: 0 }, duration: 1500, delay: stagger(200), ease: 'outCubic' }, 620)
    })
    return () => scope.current?.revert()
  }, [])

  // Error: la hoja tiembla, como un "no" con la cabeza
  useEffect(() => {
    if (!error || quieto || !root.current) return
    animate(root.current.querySelector('.tk-auth__form')!, { x: [0, -10, 9, -6, 4, 0], duration: 450, ease: 'outSine' })
  }, [error])

  async function handleLogin() {
    if (!email.trim() || !password) { setError('Completa todos los campos'); return }
    setLoading(true)
    setError('')
    const err = await signIn(email.trim(), password)
    if (err) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
    }
    // Si no hay error, AuthContext detecta la sesión y App redirige automáticamente
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleLogin()
  }

  return (
    <div className="tk-auth" ref={root}>
      {/* Marca: el toque (tak) que se expande en ondas */}
      <div className="tk-auth__art">
        <div className="tk-auth__mark">
          <span className="tk-auth__ripple" aria-hidden="true"><i /><i /><i /></span>
          <TakLogo className="tk-auth__logo" />
        </div>
      </div>

      {/* Hoja con el formulario */}
      <div className="tk-auth__panel">
        <form className="tk-auth__form" onSubmit={handleSubmit} noValidate>
          <span className="tk-auth__grabber" aria-hidden="true" />
          <h1 className="tk-auth__title">Hola de nuevo</h1>

          <label className="tk-field">
            <span className="tk-field__label">Correo electrónico</span>
            <input
              className="tk-input"
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              enterKeyHint="next"
              aria-invalid={!!error}
            />
          </label>

          <label className="tk-field">
            <span className="tk-field__label">Contraseña</span>
            <span className="tk-input-wrap">
              <input
                className="tk-input"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                style={{ paddingRight: 96 }}
                autoComplete="current-password"
                enterKeyHint="go"
                aria-invalid={!!error}
              />
              <span className="tk-input-wrap__action">
                <Btn variant="text" small onClick={() => setShowPass(!showPass)} ariaLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </Btn>
              </span>
            </span>
          </label>

          {error && <Alert>{error}</Alert>}

          <div className="tk-auth__cta">
            <Btn type="submit" disabled={loading} loading={loading} block>
              {loading ? 'Entrando…' : 'Entrar'}
            </Btn>
          </div>

          <p className="tk-auth__foot">¿Sin acceso? Pídeselo a tu gerente o a tak!</p>
        </form>
      </div>
    </div>
  )
}
