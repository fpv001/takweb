import { useAuth } from '@/context/AuthContext'
import { LoginPage } from '@/routes/LoginPage'
import { AtlasAdmin } from '@/routes/AtlasAdmin'
import { HotelDashboard } from '@/routes/HotelDashboard'
import { ColaboradorDashboard } from '@/routes/ColaboradorDashboard'
import { TipPage } from '@/routes/TipPage'
import { Btn, FullscreenLoader } from '@/components/UI'
import { Icon } from '@/components/Icon'

function Spinner() {
  return <FullscreenLoader />
}

function ErrorPerfil({ mensaje, onSignOut }: { mensaje: string; onSignOut: () => void }) {
  return (
    <div className="tk-fullscreen">
      <span className="tk-empty__mark" style={{ marginBottom: 8 }}><Icon name="warning" /></span>
      <h1 style={{ font: 'var(--t-h3)' }}>No pudimos abrir tu panel</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: 360 }}>{mensaje}</p>
      <div style={{ marginTop: 8 }}><Btn variant="secondary" icon="logout" onClick={onSignOut}>Cerrar sesión</Btn></div>
    </div>
  )
}

export function App() {
  const { session, perfil, loading, signOut } = useAuth()
  const path = window.location.pathname

  // ── Rutas públicas — no requieren login ──────────────────────────────────
  const tipMatch = path.match(/^\/tip\/(.+)$/)
  if (tipMatch) return <TipPage linkId={tipMatch[1]} />

  // ── Rutas privadas — requieren login ─────────────────────────────────────
  if (loading) return <Spinner />
  if (!session || !perfil) return <LoginPage />

  switch (perfil.rol) {
    case 'atlas_admin':
      return <AtlasAdmin />

    case 'hotel_admin':
      if (!perfil.hotel_id) return <ErrorPerfil mensaje="Tu cuenta no tiene un hotel asignado. Contacta a tu administrador de tak!" onSignOut={signOut} />
      return <HotelDashboard hotelId={perfil.hotel_id} />

    case 'colaborador':
      if (!perfil.colaborador_id) return <ErrorPerfil mensaje="Tu cuenta no tiene un colaborador asignado. Contacta a tu administrador de tak!" onSignOut={signOut} />
      return <ColaboradorDashboard linkId={perfil.colaborador_id} useId />

    default:
      return <ErrorPerfil mensaje="Tu cuenta tiene un rol desconocido. Contacta a tu administrador de tak!" onSignOut={signOut} />
  }
}
