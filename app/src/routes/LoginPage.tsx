import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Alert, Btn } from '@/components/UI'
import logoUrl from '@/assets/tak-logo.webp'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

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

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="tk-auth">
      {/* Panel de marca */}
      <div className="tk-auth__art">
        <img className="tk-auth__logo" src={logoUrl} alt="tak!" />
        <div>
          <p className="tk-auth__claim">Cada gracias, visible para tu equipo.</p>
          <p className="tk-auth__slogan">thanks are kind!</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="tk-auth__panel">
        <div className="tk-auth__form">
          <h1 className="tk-auth__title">Entra a tak!</h1>
          <p className="tk-auth__sub">Usa el correo y la contraseña que te asignaron.</p>

          <label className="tk-field">
            <span className="tk-field__label">Correo electrónico</span>
            <input
              className="tk-input"
              type="email"
              placeholder="tu@hotel.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="email"
              inputMode="email"
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
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKey}
                style={{ paddingRight: 96 }}
                autoComplete="current-password"
              />
              <span className="tk-input-wrap__action">
                <Btn variant="text" small onClick={() => setShowPass(!showPass)} ariaLabel={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </Btn>
              </span>
            </span>
          </label>

          {error && <Alert>{error}</Alert>}

          <div style={{ marginTop: 8 }}>
            <Btn onClick={handleLogin} disabled={loading} loading={loading} block>
              {loading ? 'Entrando…' : 'Entrar'}
            </Btn>
          </div>

          <p className="tk-auth__foot">Propinas digitales por <strong>tak!</strong></p>
        </div>
      </div>
    </div>
  )
}
