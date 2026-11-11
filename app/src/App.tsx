import { lazy, Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Btn, AppSkeleton, LaunchScreen } from '@/components/UI'
import { Icon } from '@/components/Icon'
import { loadAtlas, loadColaborador, loadHotel, loadLogin, loadResena, loadTip } from '@/routes/loaders'

// Cada ruta es su propio archivo: el huésped no descarga los paneles ni las gráficas
const LoginPage = lazy(() => loadLogin().then(m => ({ default: m.LoginPage })))
const AtlasAdmin = lazy(() => loadAtlas().then(m => ({ default: m.AtlasAdmin })))
const HotelDashboard = lazy(() => loadHotel().then(m => ({ default: m.HotelDashboard })))
const ColaboradorDashboard = lazy(() => loadColaborador().then(m => ({ default: m.ColaboradorDashboard })))
const TipPage = lazy(() => loadTip().then(m => ({ default: m.TipPage })))
const ResenaPage = lazy(() => loadResena().then(m => ({ default: m.ResenaPage })))

// Solo revisa si existe la llave de sesión de Supabase (no lee su contenido) para elegir la carga correcta
function haySesionGuardada() {
  try { return Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')) } catch { return false }
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
  if (tipMatch) return <Suspense fallback={<LaunchScreen />}><TipPage linkId={tipMatch[1]} /></Suspense>
  const resenaMatch = path.match(/^\/r\/(.+)$/)
  if (resenaMatch) return <Suspense fallback={<LaunchScreen />}><ResenaPage linkId={resenaMatch[1]} /></Suspense>

  // ── Rutas privadas — requieren login ─────────────────────────────────────
  if (loading) return haySesionGuardada() ? <AppSkeleton /> : <LaunchScreen />
  if (!session || !perfil) return <Suspense fallback={<LaunchScreen />}><LoginPage /></Suspense>

  return (
    <Suspense fallback={<AppSkeleton variant={perfil.rol === 'colaborador' ? 'perfil' : 'panel'} />}>
      <Panel rol={perfil.rol} hotelId={perfil.hotel_id} colaboradorId={perfil.colaborador_id} onSignOut={signOut} />
    </Suspense>
  )
}

function Panel({ rol, hotelId, colaboradorId, onSignOut }: { rol: string; hotelId: string | null; colaboradorId: string | null; onSignOut: () => void }) {
  switch (rol) {
    case 'atlas_admin':
      return <AtlasAdmin />
    case 'hotel_admin':
      if (!hotelId) return <ErrorPerfil mensaje="Tu cuenta no tiene un hotel asignado. Contacta a tu administrador de tak!" onSignOut={onSignOut} />
      return <HotelDashboard hotelId={hotelId} />
    case 'colaborador':
      if (!colaboradorId) return <ErrorPerfil mensaje="Tu cuenta no tiene un colaborador asignado. Contacta a tu administrador de tak!" onSignOut={onSignOut} />
      return <ColaboradorDashboard linkId={colaboradorId} useId />
    default:
      return <ErrorPerfil mensaje="Tu cuenta tiene un rol desconocido. Contacta a tu administrador de tak!" onSignOut={onSignOut} />
  }
}
