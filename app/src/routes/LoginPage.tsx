import { useEffect, useRef, useState } from 'react'
import { animate, createScope, createTimeline, stagger, type Scope } from 'animejs'
import { useAuth } from '@/context/AuthContext'
import { Alert, Btn } from '@/components/UI'
import { TakLogo } from '@/components/TakLogo'

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

  // Entrada: las letras caen con rebote, el "!" hace el toque y la hoja sube con el formulario
  useEffect(() => {
    if (quieto) return
    scope.current = createScope({ root }).add(() => {
      createTimeline({ defaults: { ease: 'outExpo' } })
        .add('.tk-logo__glyph', {
          y: [{ from: -90, to: 0, ease: 'outBounce', duration: 700 }],
          opacity: { from: 0, duration: 200 },
          scaleY: [{ from: 1.25, to: .85, duration: 520 }, { to: 1, ease: 'outElastic(1, .5)', duration: 500 }],
          delay: stagger(90),
        })
        .add('.tk-logo__glyph:last-child', {
          rotate: [{ to: -12, duration: 120 }, { to: 0, ease: 'outElastic(1, .4)', duration: 700 }],
        }, '-=700')
        .add('.tk-auth__form', { y: { from: '100%' }, duration: 900 }, 250)
        .add('.tk-auth__form > *', { y: { from: 18 }, opacity: { from: 0 }, duration: 600, delay: stagger(55) }, 450)
      // Ondas del toque, en loop, saliendo del logo cuando cae el "!"
      animate('.tk-auth__ripple i', {
        scale: { from: .1, to: 1 }, opacity: { from: .9, to: 0 },
        duration: 3600, ease: 'outCubic', delay: stagger(1200, { start: 850 }), loopDelay: 0, loop: true,
      })
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
