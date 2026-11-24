import { useState, type FormEvent } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Alert, Btn } from '@/components/UI'
import { TakLogo } from '@/components/TakLogo'

// Primer ingreso (o tras restablecer): la contraseña la eligió otra persona, así que se pide una nueva.
// La marca cambiar_password la pone la Edge Function crear-usuario; aquí se quita al guardar.
export function CambiarPassword({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [ver, setVer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Usa al menos 8 caracteres'); return }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password, data: { cambiar_password: false } })
    setSaving(false)
    if (err) {
      setError(/different/i.test(err.message) ? 'Elige una contraseña distinta a la temporal' : err.message)
    }
    // Si sale bien, Supabase actualiza la sesión y la app abre el panel sola
  }

  return (
    <div className="tk-auth">
      <div className="tk-auth__art">
        <div className="tk-auth__mark"><TakLogo className="tk-auth__logo" /></div>
      </div>
      <div className="tk-auth__panel">
        <form className="tk-auth__form" onSubmit={handleSubmit} noValidate>
          <span className="tk-auth__grabber" aria-hidden="true" />
          <h1 className="tk-auth__title">Elige tu contraseña</h1>
          <p className="tk-muted" style={{ marginBottom: 16 }}>
            Entraste a <strong>{email}</strong> con una contraseña temporal. Crea una nueva que solo tú conozcas.
          </p>

          <label className="tk-field">
            <span className="tk-field__label">Contraseña nueva</span>
            <input className="tk-input" type={ver ? 'text' : 'password'} value={password} autoComplete="new-password"
              onChange={e => { setPassword(e.target.value); setError('') }} aria-invalid={!!error} />
          </label>
          <label className="tk-field">
            <span className="tk-field__label">Repítela</span>
            <input className="tk-input" type={ver ? 'text' : 'password'} value={confirmar} autoComplete="new-password"
              onChange={e => { setConfirmar(e.target.value); setError('') }} aria-invalid={!!error} />
          </label>
          <label className="tk-check" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={ver} onChange={e => setVer(e.target.checked)} /> Mostrar contraseñas
          </label>

          {error && <Alert>{error}</Alert>}

          <div className="tk-auth__cta">
            <Btn type="submit" disabled={saving} loading={saving} block>{saving ? 'Guardando…' : 'Guardar y entrar'}</Btn>
          </div>
          <p className="tk-auth__foot">
            <Btn variant="text" small onClick={onSignOut}>Cerrar sesión</Btn>
          </p>
        </form>
      </div>
    </div>
  )
}
