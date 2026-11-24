import { useEffect, useState } from 'react'
import { useStickyState } from '@/lib/sticky'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { getInitials, formatMXN } from '@/lib/utils'
import { AccesosPanel } from '@/components/AccesosPanel'
import { exportCSV, formatDateFull } from '@/lib/export'
import { useRealtimeHotel, useRealtimeResenas } from '@/lib/realtime'
import { fetchResenas, type Resena } from '@/lib/resenas'
import { googleReviewUrl, limpiarPlaceId } from '@/lib/googlePlace'
import { etiquetasNegocio, bienvenidaNegocio, modulosDe } from '@/lib/negocio'
import { TIP_BASE_URL, RESENA_BASE_URL, insertarColaborador, insertarConLink, linkColaborador } from '@/lib/slug'
import { EquiposPanel } from '@/components/EquiposPanel'
import { PlatillosPanel } from '@/components/PlatillosPanel'
import { SucursalesPanel, type Sucursal, type SucursalStats } from '@/components/SucursalesPanel'
import { ColaboradorDashboard } from '@/routes/ColaboradorDashboard'
import { ExpedienteModal, ColaboradorAvatar, type ColaboradorCompleto } from '@/components/ExpedienteModal'
import { Toast } from '@/components/UI'
import {
  AppLayout, SubpageLayout, PageContent, PageHeader, SectionHeader, Card, KpiRow, KpiCard,
  Table, Tr, Td, StatusBadge, Badge, ActiveBadge, Btn, IconBtn, Modal, ModalActions, FormField, Input, Select, Spinner,
  Avatar, Alert, EmptyState, LiveIndicator, Stars,
} from '@/components/UI'
import { Icon } from '@/components/Icon'
import { TrendBars, RatingBreakdown, KpiSpark, TopRings } from '@/components/Stats'

type Hotel = { id: string; nombre: string; tipo: string | null; stripe_api_key: string | null; google_place_id: string | null; modulos: Partial<{ docks: boolean; propinas: boolean }> | null }
type Colaborador = { id: string; nombre: string; puesto: string | null; activo: boolean; link_unico: string; created_at: string; foto_url: string | null; telefono: string | null; fecha_ingreso: string | null; notas: string | null; hotel_id: string }
type Propina = { id: string; monto_total: number; estado: string; colaborador_id: string; created_at: string }
type ModoDock = 'resena' | 'agradecer' | 'ambos'
type PuntoResena = { id: string; hotel_id: string; sucursal_id: string | null; nombre: string; link_unico: string; activo: boolean; created_at: string; modo: ModoDock | null; pregunta: string | null }
type DockColaborador = { punto_id: string; colaborador_id: string; orden: number }
const PREGUNTA_DOCK = '¿A quién quieres agradecer?'
const MODOS_DOCK: { value: ModoDock; label: string; desc: string }[] = [
  { value: 'resena', label: 'Solo reseña del lugar', desc: 'Piden estrellas y comentario del negocio. Es lo que hacen los docks hoy.' },
  { value: 'agradecer', label: 'Agradecer a alguien del equipo', desc: 'Se abre la ventana con las fotos del equipo que elijas abajo. Al tocar a alguien entra a su flujo de agradecer.' },
  { value: 'ambos', label: 'Ambos', desc: 'La ventana del equipo y, abajo, “Prefiero calificar el lugar” para dejar la reseña del negocio.' },
]
type Tab = 'resumen' | 'equipo' | 'propinas' | 'resenas' | 'sucursales' | 'docks' | 'platillos' | 'equipos' | 'leaderboard' | 'accesos' | 'configuracion'
type FiltroEstrellas = 'todas' | '5' | '4' | 'bajas'
type FiltroComentario = 'todas' | 'mensaje' | 'calificacion' | 'bajas' | 'altas'

const PAGE_SIZE = 50

function promedioDe(rs: Resena[]) {
  const con = rs.filter(r => r.estrellas !== null)
  return con.length ? con.reduce((s, r) => s + (r.estrellas ?? 0), 0) / con.length : 0
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

const NAV = [
  { id: 'resumen', label: 'Resumen', icon: 'resumen' },
  { id: 'equipo', label: 'Mi equipo', icon: 'users' },
  { id: 'propinas', label: 'Propinas', icon: 'tip' },
  { id: 'resenas', label: 'Reseñas', icon: 'star' },
  { id: 'sucursales', label: 'Sucursales', icon: 'hotel' },
  { id: 'docks', label: 'Docks', icon: 'card' },
  { id: 'platillos', label: 'Platillos', icon: 'camera' },
  { id: 'equipos', label: 'Repartos', icon: 'split' },
  { id: 'leaderboard', label: 'Ranking', icon: 'trophy' },
  { id: 'accesos', label: 'Accesos', icon: 'key' },
  { id: 'configuracion', label: 'Configuración', icon: 'settings' },
]

type Props = { hotelId: string; onBack?: () => void }

export function HotelDashboard({ hotelId, onBack }: Props) {
  const [tab, setTab] = useStickyState<Tab>(`tak:negocio:${hotelId}:tab`, 'resumen')
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [propinas, setPropinas] = useState<Propina[]>([])
  const [resenas, setResenas] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [colModal, setColModal] = useState<Colaborador | 'new' | null>(null)
  // Rol de quien usa el panel: el gerente, o el admin de tak! que entró a este negocio
  const { perfil } = useAuth()
  const [toast, setToast] = useState<string | null>(null)
  const [colDetalle, setColDetalle] = useStickyState<string | null>(`tak:negocio:${hotelId}:colaborador`, null)
  const [expediente, setExpediente] = useState<Colaborador | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Colaborador | null>(null)
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [savingGoogle, setSavingGoogle] = useState(false)
  const [filtroColab, setFiltroColab] = useState('all')
  const [filtroOrigen, setFiltroOrigen] = useState('todos')
  const [docks, setDocks] = useState<PuntoResena[]>([])
  const [dockCols, setDockCols] = useState<DockColaborador[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [filtroSucursal, setFiltroSucursal] = useState('all')
  const [dockModal, setDockModal] = useState<PuntoResena | 'new' | null>(null)
  const [filtroEstrellas, setFiltroEstrellas] = useState<FiltroEstrellas>('todas')
  const [filtroComent, setFiltroComent] = useState<FiltroComentario>('todas')
  const [visibleCalif, setVisibleCalif] = useState(PAGE_SIZE)
  const [visibleComent, setVisibleComent] = useState(PAGE_SIZE)

  function resetPaginas() {
    setVisibleCalif(PAGE_SIZE)
    setVisibleComent(PAGE_SIZE)
  }

  useEffect(() => { loadAll() }, [hotelId])

  useRealtimeHotel(hotelId, (monto, colaboradorId) => {
    const col = colaboradores.find(c => c.id === colaboradorId)
    setToast(`Nueva propina de ${formatMXN(monto)}${col ? ` para ${col.nombre}` : ''}`)
    loadAll()
  })

  useRealtimeResenas(hotelId, (resena, esNueva) => {
    setResenas(prev => prev.some(r => r.id === resena.id)
      ? prev.map(r => r.id === resena.id ? resena : r)
      : [resena, ...prev])
    if (esNueva) setToast('Nueva reseña recibida')
  })

  // Drill-down colaborador
  if (colDetalle) {
    return <ColaboradorDashboard linkId={colDetalle} useId onBack={() => setColDetalle(null)} />
  }

  // loading arranca en true: solo la primera carga muestra esqueleto, las recargas en vivo son silenciosas
  async function loadAll() {
    const [{ data: h }, { data: cols }, { data: props }, { data: dk }, { data: suc }] = await Promise.all([
      supabase.from('hotels').select('*').eq('id', hotelId).single(),
      supabase.from('colaboradores').select('*').eq('hotel_id', hotelId).order('nombre'),
      supabase.from('propinas').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false }),
      supabase.from('puntos_resena').select('*').eq('hotel_id', hotelId).order('created_at'),
      supabase.from('sucursales').select('*').eq('hotel_id', hotelId).order('created_at'),
    ])
    setSucursales((suc as Sucursal[]) ?? [])
    const hotelData = h as Hotel
    setHotel(hotelData)
    setGooglePlaceId(hotelData?.google_place_id ?? '')
    setColaboradores((cols as Colaborador[]) ?? [])
    setPropinas((props as Propina[]) ?? [])
    const listaDocks = (dk as PuntoResena[]) ?? []
    setDocks(listaDocks)
    if (listaDocks.length) {
      const { data: dc, error: errorDc } = await supabase.from('dock_colaboradores').select('punto_id, colaborador_id, orden').in('punto_id', listaDocks.map(d => d.id)).order('orden')
      if (errorDc) console.error('Error cargando equipo de docks:', errorDc)
      setDockCols((dc as DockColaborador[]) ?? [])
    } else setDockCols([])
    const listaPropinas = (props as Propina[]) ?? []
    const colPorPropina = new Map(listaPropinas.map(p => [p.id, p.colaborador_id]))
    const res = await fetchResenas({ hotel_id: hotelId }, listaPropinas.map(p => p.id))
    setResenas(res.map(r => r.colaborador_id || !r.propina_id ? r : { ...r, colaborador_id: colPorPropina.get(r.propina_id) ?? null }))
    setLoading(false)
  }

  function exportarPropinas() {
    exportCSV(`propinas-${hotel?.nombre ?? 'negocio'}`,
      ['Colaborador', 'Puesto', 'Monto', 'Estado', 'Fecha'],
      propinas.map(p => {
        const col = colaboradores.find(c => c.id === p.colaborador_id)
        return [col?.nombre ?? '—', col?.puesto ?? '—', p.monto_total, p.estado, formatDateFull(p.created_at)]
      })
    )
  }

  async function saveGooglePlaceId() {
    const { valor, error: errorLimpieza, advertencia } = limpiarPlaceId(googlePlaceId)
    if (errorLimpieza) {
      setToast(errorLimpieza)
      return
    }
    setSavingGoogle(true)
    try {
      const { error } = await supabase.rpc('set_hotel_google_place_id', { p_hotel_id: hotelId, p_place_id: valor })
      if (error) {
        setToast('No se pudo guardar: ' + error.message)
        return
      }
      // Vuelve a leer el valor desde Supabase para confirmar que quedó guardado
      const { data, error: errorLectura } = await supabase.from('hotels').select('google_place_id').eq('id', hotelId).single()
      if (errorLectura) {
        setToast('Se envió, pero no pudimos confirmar el guardado: ' + errorLectura.message)
        return
      }
      const guardado = (data?.google_place_id as string | null) || null
      setHotel(h => h ? { ...h, google_place_id: guardado } : h)
      setGooglePlaceId(guardado ?? '')
      if (!guardado) setToast('Google Place ID eliminado')
      else setToast(advertencia ? `Google Place ID guardado. ${advertencia}` : 'Google Place ID guardado')
    } catch (err) {
      setToast('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setSavingGoogle(false)
    }
  }

  async function toggleDock(d: PuntoResena) {
    const { error } = await supabase.from('puntos_resena').update({ activo: !d.activo }).eq('id', d.id)
    if (error) { setToast('No se pudo cambiar el estado: ' + error.message); return }
    loadAll()
  }

  // Tab Reseñas: el filtro de colaborador aplica a indicadores y a las dos tarjetas
  // Origen: colaboradores (con colaborador_id), docks (con punto_id) o un dock específico
  const cumpleOrigen = (r: Resena) => {
    if (filtroOrigen === 'todos') return true
    if (filtroOrigen === 'colaboradores') return r.colaborador_id !== null
    if (filtroOrigen === 'docks') return r.punto_id !== null
    return r.punto_id === filtroOrigen
  }
  const resenasTab = resenas.filter(r => (filtroColab === 'all' || r.colaborador_id === filtroColab) && cumpleOrigen(r))
  const conEstrellasTab = resenasTab.filter(r => r.estrellas !== null)
  const conTextoTab = resenasTab.filter(r => r.comentario?.trim())
  const califTab = promedioDe(conEstrellasTab)
  const califFiltradas = conEstrellasTab.filter(r => {
    if (filtroEstrellas === 'todas') return true
    if (filtroEstrellas === 'bajas') return (r.estrellas ?? 0) <= 3
    return r.estrellas === Number(filtroEstrellas)
  })
  const comentFiltrados = conTextoTab.filter(r => {
    if (filtroComent === 'mensaje') return r.estrellas === null
    if (filtroComent === 'calificacion') return r.estrellas !== null
    if (filtroComent === 'bajas') return r.estrellas !== null && r.estrellas <= 3
    if (filtroComent === 'altas') return r.estrellas !== null && r.estrellas >= 4
    return true
  })
  const porColab = colaboradores.map(c => {
    const cs = conEstrellasTab.filter(r => r.colaborador_id === c.id)
    return { id: c.id, nombre: c.nombre, n: cs.length, promedio: promedioDe(cs) }
  }).filter(c => c.n > 0).sort((a, b) => b.promedio - a.promedio || b.n - a.n)
  // Reseña del lugar: solo dock. Agradecimiento desde un dock: trae colaborador y dock -> "Ana · vía Barra"
  const nombreAutor = (r: Resena) => {
    const dock = r.punto_id ? docks.find(d => d.id === r.punto_id)?.nombre ?? '—' : null
    const col = r.colaborador_id ? colaboradores.find(c => c.id === r.colaborador_id)?.nombre ?? '—' : null
    if (col && dock) return `${col} · vía ${dock}`
    return dock ? `Dock: ${dock}` : col ?? '—'
  }
  // Vista por sucursal: docks filtrados y resumen de cada sucursal
  const docksFiltrados = filtroSucursal === 'all' ? docks : docks.filter(d => d.sucursal_id === filtroSucursal)
  const statsSucursales: Record<string, SucursalStats> = Object.fromEntries(sucursales.map(s => {
    const ids = new Set(docks.filter(d => d.sucursal_id === s.id).map(d => d.id))
    const rs = resenas.filter(r => r.punto_id !== null && ids.has(r.punto_id) && !r.colaborador_id)
    return [s.id, { docks: ids.size, resenas: rs.length, promedio: promedioDe(rs) }]
  }))

  const porDock = docks.map(d => {
    // Solo reseñas del lugar; los agradecimientos cuentan para su colaborador
    const ds = conEstrellasTab.filter(r => r.punto_id === d.id && !r.colaborador_id)
    return { id: d.id, nombre: d.nombre, n: ds.length, promedio: promedioDe(ds) }
  }).filter(d => d.n > 0).sort((a, b) => b.promedio - a.promedio || b.n - a.n)
  const previewPlaceId = limpiarPlaceId(googlePlaceId)
  const et = etiquetasNegocio(hotel?.tipo)
  const mods = modulosDe(hotel)
  // Pestañas de propinas solo si el negocio tiene el módulo activo
  const SOLO_PROPINAS: Tab[] = ['propinas', 'equipo', 'equipos', 'leaderboard']
  const esAtlas = perfil?.rol === 'atlas_admin'
  const navItems = NAV.filter(n => (mods.propinas || !SOLO_PROPINAS.includes(n.id as Tab)) && (n.id !== 'platillos' || et.tipo === 'restaurante')
    // Accesos: el gerente administra los de sus colaboradores (requiere el módulo); tak! siempre (crea gerentes)
    && (n.id !== 'accesos' || esAtlas || mods.propinas))

  const totalPropinas = propinas.reduce((s, p) => s + p.monto_total, 0)
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const propinasMes = propinas.filter(p => new Date(p.created_at) >= inicioMes)
  const totalMes = propinasMes.reduce((s, p) => s + p.monto_total, 0)
  const promedio = propinas.length ? totalPropinas / propinas.length : 0
  const resenasConEstrellas = resenas.filter(r => r.estrellas)
  const calificacion = resenasConEstrellas.length
    ? resenasConEstrellas.reduce((s, r) => s + (r.estrellas ?? 0), 0) / resenasConEstrellas.length : 0
  const topCols = colaboradores.map(c => {
    const props = propinas.filter(p => p.colaborador_id === c.id)
    return { ...c, total: props.reduce((s, p) => s + p.monto_total, 0), count: props.length }
  }).sort((a, b) => b.total - a.total)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('es-MX', { weekday: 'short' })
    const total = propinas.filter(p => p.created_at.startsWith(key)).reduce((s, p) => s + p.monto_total, 0)
    return { label, total }
  })
  const maxBar = Math.max(...last7.map(d => d.total), 1)

  if (!hotel && !loading) return (
    <div className="tk-fullscreen">
      <EmptyState icon="hotel" title={`${et.singularCap} no encontrado`} text="Puede que se haya eliminado o que tu cuenta ya no tenga acceso."action={onBack ? <Btn variant="secondary" icon="back" onClick={onBack}>Volver</Btn> : undefined} />
    </div>
  )

  const mainContent = (
    <PageContent>
      {dockModal !== null && <DockModal punto={dockModal === 'new' ? null : dockModal} hotelId={hotelId} sucursales={sucursales} sucursalInicial={filtroSucursal !== 'all' ? filtroSucursal : null} nombreNegocio={hotel?.nombre ?? ''}
        colaboradores={colaboradores} asignados={dockModal === 'new' ? [] : dockCols.filter(x => x.punto_id === dockModal.id)} equipoDisponible={mods.propinas}
        onIrEquipo={() => { setDockModal(null); setTab('equipo') }}
        onClose={() => setDockModal(null)} onSaved={loadAll} />}
      {loading ? <Spinner /> : (
        <>
          {/* ══ RESUMEN ══ */}
          {tab === 'resumen' && (
            <>
              <PageHeader title={bienvenidaNegocio(hotel?.tipo)} subtitle={hotel?.nombre ?? ''} action={<LiveIndicator label="Propinas en vivo" />} />
              <KpiRow>
                <KpiCard featured label="Calificación" value={calificacion > 0 ? calificacion.toFixed(1) : '—'} sub={`${resenasConEstrellas.length} reseñas`} icon="star" />
                <KpiCard label="Este mes" value={formatMXN(totalMes)} sub={`${propinasMes.length} propinas`} icon="tip"><KpiSpark values={last7.map(d => d.total)} /></KpiCard>
                <KpiCard label="Total histórico" value={formatMXN(totalPropinas)} sub={`${propinas.length} propinas`} icon="trend" />
                <KpiCard label="Equipo activo" value={String(colaboradores.filter(c => c.activo).length)} sub="colaboradores" icon="users" />
              </KpiRow>
              <div className="tk-grid-main">
                <Card title="Propinas de los últimos 7 días" meta="Monto recibido por día">
                  <TrendBars data={last7} label="Propinas de los últimos 7 días" format={n => formatMXN(n).replace('MX$', '$')} />
                </Card>
                <Card title="Top colaboradores" meta="Por monto recibido">
                  {topCols.length === 0 ? (
                    <EmptyState inline icon="users" title="Sin datos aún" />
                  ) : (
                    <>
                    <TopRings items={topCols.map(c => ({ label: c.nombre, value: c.total }))} format={n => formatMXN(n).replace('MX$', '$')} centerLabel="Top 4" label="Top colaboradores por monto" />
                    <div className="tk-list">
                      {topCols.slice(0, 5).map((c, i) => (
                        <div key={c.id} className="tk-list__item">
                          <span className="tk-list__rank">{i + 1}</span>
                          <ColaboradorAvatar col={c} size={36} />
                          <div className="tk-list__main">
                            <p className="tk-list__name">{c.nombre}</p>
                            <p className="tk-list__meta">{c.count} propinas</p>
                          </div>
                          <div className="tk-list__end">
                            <span className="tk-list__amount">{formatMXN(c.total)}</span>
                            <Btn small variant="text" onClick={() => setColDetalle(c.id)} ariaLabel={`Ver estadísticas de ${c.nombre}`}>Ver</Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                    </>
                  )}
                </Card>
              </div>
              <div style={{ marginTop: 32 }}>
                <SectionHeader title="Actividad reciente" subtitle="Las 10 propinas más recientes" />
                {propinas.length === 0 ? (
                  <EmptyState icon="tip" title="Aún no hay propinas registradas" text="Cuando un huésped toque una pulsera tak! y deje propina, aparecerá aquí al instante." />
                ) : (
                  <Table headers={['Colaborador', 'Monto', 'Estado', 'Hace']} numCols={[1]}>
                    {propinas.slice(0, 10).map(p => {
                      const col = colaboradores.find(c => c.id === p.colaborador_id)
                      return (
                        <Tr key={p.id}>
                          <Td bold>
                            <span className="tk-cell-person">{col ? <ColaboradorAvatar col={col} size={32} /> : <Avatar name="?" size={32} />}<span>{col?.nombre ?? '—'}</span></span>
                          </Td>
                          <Td right bold>{formatMXN(p.monto_total)}</Td>
                          <Td><StatusBadge estado={p.estado} /></Td>
                          <Td muted nowrap>{timeAgo(p.created_at)}</Td>
                        </Tr>
                      )
                    })}
                  </Table>
                )}
              </div>
            </>
          )}

          {/* ══ EQUIPO ══ */}
          {tab === 'equipo' && (
            <>
              <PageHeader
                title="Mi equipo"
                subtitle={`${colaboradores.filter(c => c.activo).length} colaboradores activos`}
                action={
                  <>
                    <Btn variant="secondary" icon="key" onClick={() => setTab('accesos')}>Accesos</Btn>
                    <Btn icon="plus" onClick={() => setColModal('new')}>Nuevo colaborador</Btn>
                  </>
                }
              />
              {colaboradores.length === 0 ? (
                <EmptyState icon="users" title={`Aún no hay colaboradores en este ${et.singular}`} text="Agrega a tu equipo para generar el enlace NFC de cada pulsera." action={<Btn icon="plus" onClick={() => setColModal('new')}>Nuevo colaborador</Btn>} />
              ) : (
                <Table headers={['Colaborador', 'Puesto', 'Enlace NFC', 'Propinas', 'Total', 'Estado', '']} numCols={[3, 4]}>
                  {topCols.map(c => (
                    <Tr key={c.id}>
                      <Td bold>
                        <span className="tk-cell-person"><ColaboradorAvatar col={c} size={36} /><span>{c.nombre}</span></span>
                      </Td>
                      <Td muted>{c.puesto ?? '—'}</Td>
                      <Td>
                        <CopyLink linkUnico={c.link_unico} />
                      </Td>
                      <Td right muted>{c.count}</Td>
                      <Td right bold>{formatMXN(c.total)}</Td>
                      <Td><ActiveBadge activo={c.activo} /></Td>
                      <Td>
                        <div className="tk-row-actions">
                          <Btn small variant="secondary" onClick={() => setColDetalle(c.id)}>Estadísticas</Btn>
                          <Btn small variant="secondary" onClick={() => setExpediente(c)}>Expediente</Btn>
                          <IconBtn small icon="edit" label={`Editar ${c.nombre}`} onClick={() => setColModal(c)} />
                          <IconBtn small danger icon="trash" label={`Eliminar a ${c.nombre}`} onClick={() => setDeleteTarget(c)} />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Table>
              )}
            </>
          )}

          {/* ══ PROPINAS ══ */}
          {tab === 'propinas' && (
            <>
              <PageHeader title="Propinas" subtitle={`Historial de todas las propinas del ${et.singular}`} action={<Btn variant="secondary" icon="download" onClick={exportarPropinas}>Exportar CSV</Btn>} />
              <KpiRow>
                <KpiCard featured label="Este mes" value={formatMXN(totalMes)} sub={`${propinasMes.length} transacciones`} icon="tip" />
                <KpiCard label="Total histórico" value={formatMXN(totalPropinas)} sub={`${propinas.length} propinas`} icon="trend" />
                <KpiCard label="Promedio" value={promedio > 0 ? formatMXN(promedio) : '—'} sub="por propina" icon="chart" />
              </KpiRow>
              {propinas.length === 0 ? (
                <EmptyState icon="tip" title="Aún no hay propinas registradas" text="Las propinas aparecerán aquí con su estado y fecha." />
              ) : (
                <Table headers={['Colaborador', 'Monto', 'Estado', 'Fecha']} numCols={[1]}>
                  {propinas.map(p => {
                    const col = colaboradores.find(c => c.id === p.colaborador_id)
                    return (
                      <Tr key={p.id}>
                        <Td bold>{col?.nombre ?? '—'}</Td>
                        <Td right bold>{formatMXN(p.monto_total)}</Td>
                        <Td><StatusBadge estado={p.estado} /></Td>
                        <Td muted nowrap>{formatDate(p.created_at)}</Td>
                      </Tr>
                    )
                  })}
                </Table>
              )}
            </>
          )}

          {/* ══ RESEÑAS ══ */}
          {tab === 'resenas' && (
            <>
              <PageHeader
                title="Reseñas"
                subtitle="Lo que opinan los huéspedes de tu equipo"
                action={
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select className="tk-select" aria-label="Filtrar por origen" value={filtroOrigen} onChange={e => { setFiltroOrigen(e.target.value); resetPaginas() }}>
                      <option value="todos">Todo el origen</option>
                      <option value="colaboradores">Colaboradores</option>
                      <option value="docks">Docks</option>
                      {docks.map(d => <option key={d.id} value={d.id}>Dock: {d.nombre}</option>)}
                    </select>
                    <select className="tk-select" aria-label="Filtrar por colaborador" value={filtroColab} onChange={e => { setFiltroColab(e.target.value); resetPaginas() }}>
                      <option value="all">Todos los colaboradores</option>
                      {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                }
              />
              <KpiRow>
                <KpiCard featured label="Calificación promedio" value={califTab > 0 ? califTab.toFixed(1) : '—'} sub="de 5 estrellas" icon="star" />
                <KpiCard label="Calificaciones" value={String(conEstrellasTab.length)} sub="con estrellas" icon="history" />
                <KpiCard label="Comentarios" value={String(conTextoTab.length)} sub="con texto" icon="message" />
              </KpiRow>

              <div style={{ marginTop: 32 }}>
                <Card title="Calificaciones" meta={`${califFiltradas.length} ${califFiltradas.length === 1 ? 'calificación' : 'calificaciones'}`}>
                  {conEstrellasTab.length === 0 ? (
                    <EmptyState inline icon="star" title="Aún no hay calificaciones" text="Aparecerán aquí en cuanto los huéspedes califiquen con estrellas." />
                  ) : (
                    <>
                      <RatingBreakdown value={califTab} rows={[5, 4, 3, 2, 1].map(star => ({ star, count: conEstrellasTab.filter(r => r.estrellas === star).length }))} />

                      <SectionHeader title="Por colaborador" />
                      <Table headers={['Colaborador', 'Promedio', 'Calificaciones']} numCols={[1, 2]}>
                        {porColab.map(c => (
                          <Tr key={c.id}>
                            <Td bold>{c.nombre}</Td>
                            <Td right bold>{c.promedio.toFixed(1)}</Td>
                            <Td right muted>{c.n}</Td>
                          </Tr>
                        ))}
                      </Table>

                      {porDock.length > 0 && (
                        <>
                          <SectionHeader title="Por dock" />
                          <Table headers={['Dock', 'Promedio', 'Calificaciones']} numCols={[1, 2]}>
                            {porDock.map(d => (
                              <Tr key={d.id}>
                                <Td bold>{d.nombre}</Td>
                                <Td right bold>{d.promedio.toFixed(1)}</Td>
                                <Td right muted>{d.n}</Td>
                              </Tr>
                            ))}
                          </Table>
                        </>
                      )}

                      <SectionHeader title="Calificaciones recientes" />
                      <div className="tk-toolbar">
                        <select className="tk-select" aria-label="Filtrar por estrellas" value={filtroEstrellas} onChange={e => { setFiltroEstrellas(e.target.value as FiltroEstrellas); setVisibleCalif(PAGE_SIZE) }}>
                          <option value="todas">Todas las estrellas</option>
                          <option value="5">5 estrellas</option>
                          <option value="4">4 estrellas</option>
                          <option value="bajas">3 estrellas o menos</option>
                        </select>
                      </div>
                      {califFiltradas.length === 0 ? (
                        <EmptyState inline icon="star" title="Ninguna calificación coincide con el filtro" />
                      ) : (
                        <>
                          <Table headers={['Colaborador', 'Estrellas', 'Estado', 'Fecha']}>
                            {califFiltradas.slice(0, visibleCalif).map(r => (
                              <Tr key={r.id}>
                                <Td bold>{nombreAutor(r)}</Td>
                                <Td><Stars value={r.estrellas ?? 0} /></Td>
                                <Td><Badge text={r.publica ? 'Enviada a Google' : 'Interna'} tone={r.publica ? 'success' : 'neutral'} /></Td>
                                <Td muted nowrap>{formatDate(r.created_at)}</Td>
                              </Tr>
                            ))}
                          </Table>
                          {visibleCalif < califFiltradas.length && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                              <Btn variant="secondary" onClick={() => setVisibleCalif(c => c + PAGE_SIZE)}>
                                Cargar más ({califFiltradas.length - visibleCalif} restantes)
                              </Btn>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              </div>

              <div style={{ marginTop: 32 }}>
                <Card title="Comentarios" meta={`${comentFiltrados.length} ${comentFiltrados.length === 1 ? 'comentario' : 'comentarios'}`}>
                  {conTextoTab.length === 0 ? (
                    <EmptyState inline icon="message" title="Aún no hay comentarios" text="Los comentarios que dejen tus huéspedes, con o sin calificación, aparecerán aquí." />
                  ) : (
                    <>
                      <div className="tk-toolbar">
                        <select className="tk-select" aria-label="Filtrar comentarios por tipo" value={filtroComent} onChange={e => { setFiltroComent(e.target.value as FiltroComentario); setVisibleComent(PAGE_SIZE) }}>
                          <option value="todas">Todos</option>
                          <option value="mensaje">Solo mensajes</option>
                          <option value="calificacion">Con calificación</option>
                          <option value="bajas">3 estrellas o menos</option>
                          <option value="altas">4 estrellas o más</option>
                        </select>
                      </div>
                      {comentFiltrados.length === 0 ? (
                        <EmptyState inline icon="message" title="Ningún comentario coincide con el filtro" />
                      ) : (
                        <>
                          <Table headers={['Colaborador', 'Comentario', 'Calificación', 'Estado', 'Fecha']}>
                            {comentFiltrados.slice(0, visibleComent).map(r => (
                              <Tr key={r.id}>
                                <Td bold>{nombreAutor(r)}</Td>
                                <Td wrap>{r.comentario?.trim()}</Td>
                                <Td>{r.estrellas ? <Stars value={r.estrellas} /> : <span className="tk-muted">Solo mensaje</span>}</Td>
                                <Td><Badge text={r.publica ? 'Enviada a Google' : 'Interna'} tone={r.publica ? 'success' : 'neutral'} /></Td>
                                <Td muted nowrap>{formatDate(r.created_at)}</Td>
                              </Tr>
                            ))}
                          </Table>
                          {visibleComent < comentFiltrados.length && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                              <Btn variant="secondary" onClick={() => setVisibleComent(c => c + PAGE_SIZE)}>
                                Cargar más ({comentFiltrados.length - visibleComent} restantes)
                              </Btn>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              </div>
            </>
          )}

          {/* ══ DOCKS ══ */}
          {tab === 'sucursales' && (
            <SucursalesPanel
              hotelId={hotelId}
              sucursales={sucursales}
              stats={statsSucursales}
              onChange={loadAll}
              onVerDocks={id => { setFiltroSucursal(id); setTab('docks') }}
            />
          )}

          {tab === 'platillos' && <PlatillosPanel hotelId={hotelId} sucursales={sucursales} />}

          {tab === 'docks' && (
            <>
              <PageHeader
                title="Docks"
                subtitle={`Placas NFC en mesa, barra o recepción de tu ${et.singular}. Cada dock puede pedir reseña del lugar, mostrar a tu equipo para agradecerle, o ambas.`}
                action={sucursales.length > 0 ? <Btn icon="plus" onClick={() => setDockModal('new')}>Nuevo dock</Btn> : undefined}
              />
              {sucursales.length === 0 ? (
                <EmptyState icon="hotel" title="Primero crea una sucursal" text="Cada dock pertenece a una sucursal. Crea la tuya en la pestaña Sucursales." action={<Btn variant="secondary" onClick={() => setTab('sucursales')}>Ir a Sucursales</Btn>} />
              ) : (
                <>
                  {(() => {
                    // Checklist de setup: se oculta cuando todo está listo
                    const activos = colaboradores.filter(c => c.activo)
                    const sinFoto = activos.filter(c => !c.foto_url).length
                    const conEquipo = docks.filter(d => d.modo && d.modo !== 'resena').length
                    const equipoListo = !mods.propinas || (activos.length > 0 && sinFoto === 0)
                    if (docks.length > 0 && equipoListo) return null
                    return (
                      <div className="tk-setup" aria-label="Pasos para configurar tus docks">
                        <div className="tk-setup__step" data-done="">
                          <span className="tk-setup__n"><Icon name="check" /></span>
                          <div>
                            <p className="tk-setup__title">Sucursales</p>
                            <p className="tk-setup__text">{sucursales.length} {sucursales.length === 1 ? 'sucursal' : 'sucursales'}</p>
                          </div>
                        </div>
                        {mods.propinas && (
                          <div className="tk-setup__step" data-done={equipoListo || undefined}>
                            <span className="tk-setup__n">{equipoListo ? <Icon name="check" /> : '2'}</span>
                            <div>
                              <p className="tk-setup__title">Equipo con foto</p>
                              <p className="tk-setup__text">
                                {activos.length === 0 ? 'Agrega a tu equipo para que aparezca en los docks.'
                                  : sinFoto > 0 ? `${activos.length} activos, ${sinFoto} sin foto. Con foto los clientes los reconocen.`
                                  : `${activos.length} activos, todos con foto.`}
                              </p>
                              {!equipoListo && <Btn small variant="secondary" onClick={() => setTab('equipo')}>Ir a Mi equipo</Btn>}
                            </div>
                          </div>
                        )}
                        <div className="tk-setup__step" data-done={docks.length > 0 || undefined}>
                          <span className="tk-setup__n">{docks.length > 0 ? <Icon name="check" /> : mods.propinas ? '3' : '2'}</span>
                          <div>
                            <p className="tk-setup__title">Docks</p>
                            <p className="tk-setup__text">{docks.length === 0 ? 'Crea un dock, elige qué muestra y programa la placa con su enlace.' : `${docks.length} ${docks.length === 1 ? 'dock' : 'docks'}, ${conEquipo} con agradecimiento.`}</p>
                            {docks.length === 0 && <Btn small icon="plus" onClick={() => setDockModal('new')}>Nuevo dock</Btn>}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  <FormField label="Ver por sucursal">
                    <Select value={filtroSucursal} onChange={setFiltroSucursal}>
                      <option value="all">Todas las sucursales</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </Select>
                  </FormField>
                  {docksFiltrados.length === 0 ? (
                    <EmptyState icon="card" title="Sin docks en esta vista" text="Crea un dock para programar su placa NFC con el enlace." action={<Btn icon="plus" onClick={() => setDockModal('new')}>Nuevo dock</Btn>} />
                  ) : (
                <Table headers={['Dock', 'Sucursal', 'Muestra', 'Enlace', 'Estado', 'Reseñas', 'Agradecimientos', 'Promedio', '']} numCols={[5, 6, 7]}>
                  {docksFiltrados.map(d => {
                    const deDock = resenas.filter(r => r.punto_id === d.id)
                    const rs = deDock.filter(r => !r.colaborador_id)
                    const gracias = deDock.length - rs.length
                    const prom = promedioDe(rs)
                    const modo = d.modo ?? 'resena'
                    const nEquipo = dockCols.filter(x => x.punto_id === d.id && colaboradores.some(c => c.id === x.colaborador_id && c.activo)).length
                    return (
                      <Tr key={d.id}>
                        <Td bold>{d.nombre}</Td>
                        <Td muted>{sucursales.find(s => s.id === d.sucursal_id)?.nombre ?? '—'}</Td>
                        <Td>
                          {modo === 'resena' ? <Badge text="Reseña" tone="neutral" />
                            : nEquipo === 0 ? <Badge text="Sin equipo: muestra reseña" tone="warning" />
                            : <Badge text={`${modo === 'ambos' ? 'Ambos' : 'Agradecer'} · ${nEquipo}`} tone="success" />}
                        </Td>
                        <Td><CopyUrl url={`${RESENA_BASE_URL}/${d.link_unico}`} /></Td>
                        <Td><ActiveBadge activo={d.activo} /></Td>
                        <Td right muted>{rs.length}</Td>
                        <Td right muted>{modo === 'resena' && gracias === 0 ? '—' : gracias}</Td>
                        <Td right bold>{prom > 0 ? prom.toFixed(1) : '—'}</Td>
                        <Td>
                          <div className="tk-row-actions">
                            <Btn small variant="secondary" onClick={() => toggleDock(d)}>{d.activo ? 'Desactivar' : 'Activar'}</Btn>
                            <IconBtn small icon="edit" label={`Editar ${d.nombre}`} onClick={() => setDockModal(d)} />
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </Table>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'accesos' && (
            <AccesosPanel miRol={esAtlas ? 'atlas_admin' : 'hotel_admin'} hotelId={hotelId}
              hotels={hotel ? [{ id: hotel.id, nombre: hotel.nombre }] : []} colaboradores={colaboradores} />
          )}

          {/* ══ EQUIPOS ══ */}
          {tab === 'equipos' && (
            <>
              <PageHeader title="Equipos y repartos" subtitle="Define cómo se divide cada propina entre tu equipo" />
              <Alert tone="info">Cada equipo reparte el 100% de la propina: asigna a cada miembro su porcentaje y verifica que la suma sea exactamente 100%.</Alert>
              <EquiposPanel hotelId={hotelId} colaboradores={colaboradores} />
            </>
          )}

          {/* ══ LEADERBOARD ══ */}
          {tab === 'leaderboard' && (() => {
            const ranking = colaboradores.map(c => {
              const resCol = resenas.filter(r => r.colaborador_id === c.id && r.estrellas)
              const promedio = resCol.length ? resCol.reduce((s, r) => s + (r.estrellas ?? 0), 0) / resCol.length : 0
              const totalP = propinas.filter(p => p.colaborador_id === c.id).reduce((s, p) => s + p.monto_total, 0)
              return { ...c, promedio, totalResenas: resCol.length, totalP }
            }).filter(c => c.totalResenas > 0).sort((a, b) => b.promedio - a.promedio || b.totalResenas - a.totalResenas)
            const sinResenas = colaboradores.filter(c => !resenas.some(r => r.colaborador_id === c.id && r.estrellas))
            return (
              <>
                <PageHeader title="Ranking del equipo" subtitle="Ordenado por calificación promedio de las reseñas" />
                {ranking.length === 0 ? (
                  <EmptyState icon="trophy" title="Aún no hay reseñas para el ranking" text="En cuanto los huéspedes califiquen a tu equipo, verás aquí quién destaca." />
                ) : (
                  <div className="tk-stack">
                    {ranking.length >= 3 && (
                      <Card>
                        <div className="tk-podium">
                          {[ranking[1], ranking[0], ranking[2]].map((c, i) => {
                            const pos = i === 0 ? 2 : i === 1 ? 1 : 3
                            return (
                              <div key={c.id} className={`tk-podium__slot tk-podium__slot--${pos}`}>
                                {pos === 1 ? <Icon name="crown" className="tk-podium__crown" /> : <span style={{ height: 24 }} />}
                                <ColaboradorAvatar col={c} size={pos === 1 ? 72 : 56} />
                                <p className="tk-podium__name">{c.nombre.split(' ')[0]}</p>
                                <Stars value={Math.round(c.promedio)} />
                                <p className="tk-podium__score">{c.promedio.toFixed(1)}</p>
                                <div className="tk-podium__block" aria-label={`Lugar ${pos}`}>{pos}</div>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )}
                    <Card flush>
                      {ranking.map((c, i) => (
                        <button key={c.id} type="button" className="tk-rankrow" onClick={() => setColDetalle(c.id)} aria-label={`Lugar ${i + 1}: ${c.nombre}, ${c.promedio.toFixed(1)} estrellas. Ver estadísticas`}>
                          <span className={`tk-rankrow__pos${i < 3 ? ' is-top' : ''}`}>{i + 1}</span>
                          <ColaboradorAvatar col={c} size={40} />
                          <span className="tk-list__main">
                            <span className="tk-list__name" style={{ display: 'block' }}>{c.nombre}</span>
                            <span className="tk-list__meta" style={{ display: 'block' }}>{c.puesto ? `${c.puesto} · ` : ''}{c.totalResenas} reseña{c.totalResenas !== 1 ? 's' : ''}</span>
                          </span>
                          <span className="tk-list__end">
                            <span className="tk-rankrow__score">{c.promedio.toFixed(1)}<Icon name="star" /></span>
                            <span className="tk-list__meta tk-num">{formatMXN(c.totalP)}</span>
                          </span>
                          <Icon name="chevronRight" className="tk-chevron" />
                        </button>
                      ))}
                    </Card>
                    {sinResenas.length > 0 && (
                      <Card title="Sin reseñas aún" meta="Todavía no reciben calificaciones">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {sinResenas.map(c => <span key={c.id} className="tk-chip">{c.nombre}</span>)}
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </>
            )
          })()}

          {/* ══ CONFIGURACIÓN ══ */}
          {tab === 'configuracion' && (
            <>
              <PageHeader title="Configuración" subtitle={`Ajustes de tu ${et.singular}`} />
              <Card title="Reseñas en Google" meta={`Las reseñas de 4 y 5 estrellas pueden publicarse en el perfil de Google de tu ${et.singular}.`}>
                <div style={{ maxWidth: 560, marginTop: 8 }}>
                  <div style={{ marginBottom: 12 }}>
                    <Badge text={hotel?.google_place_id ? 'Google conectado' : 'Sin configurar'} tone={hotel?.google_place_id ? 'success' : 'neutral'} />
                  </div>
                  <FormField label="Google Place ID" hint="Pega el Place ID (ChIJ…) o el enlace completo de Google. Déjalo vacío y guarda para desconectar Google.">
                    <Input value={googlePlaceId} onChange={setGooglePlaceId} placeholder="ChIJ…" />
                  </FormField>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Btn onClick={saveGooglePlaceId} disabled={savingGoogle} loading={savingGoogle}>
                      {savingGoogle ? 'Guardando…' : 'Guardar'}
                    </Btn>
                    <Btn
                      variant="secondary"
                      icon="external"
                      disabled={!previewPlaceId.valor || !!previewPlaceId.error}
                      onClick={() => window.open(googleReviewUrl(previewPlaceId.valor), '_blank', 'noopener')}
                    >
                      Probar enlace
                    </Btn>
                  </div>
                  <p style={{ marginTop: 12, font: 'var(--t-small)' }}>
                    <a href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder" target="_blank" rel="noopener noreferrer">
                      ¿Dónde encuentro mi Place ID?
                    </a>
                  </p>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </PageContent>
  )

  if (onBack) {
    return (
      <>
        <SubpageLayout
          onBack={onBack}
          title={hotel?.nombre ?? ''}
          meta={et.panelTitulo}
          avatar={<Avatar name={hotel?.nombre ?? '?'} size={36} />}
          tabs={navItems} activeTab={tab} onTabChange={id => setTab(id as Tab)}
        >
          {mainContent}
        </SubpageLayout>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        {colModal !== null && <HotelColModal colaborador={colModal === 'new' ? null : colModal} hotelId={hotelId} nombreNegocio={hotel?.nombre ?? ''} onClose={() => setColModal(null)} onSave={() => { setColModal(null); loadAll() }} />}
        {expediente && <ExpedienteModal colaborador={expediente as ColaboradorCompleto} onClose={() => setExpediente(null)} onSave={() => { setExpediente(null); loadAll() }} />}
        {deleteTarget && <ConfirmDeleteColaborador colaborador={deleteTarget} propinasCount={propinas.filter(p => p.colaborador_id === deleteTarget.id).length} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); loadAll() }} />}
      </>
    )
  }

  return (
    <AppLayout navItems={navItems} activeTab={tab} onTabChange={id => setTab(id as Tab)} title={hotel?.nombre ?? `Mi ${et.singular}`} subtitle={et.panelTitulo}>
      {mainContent}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {colModal !== null && <HotelColModal colaborador={colModal === 'new' ? null : colModal} hotelId={hotelId} nombreNegocio={hotel?.nombre ?? ''} onClose={() => setColModal(null)} onSave={() => { setColModal(null); loadAll() }} />}

      {expediente && <ExpedienteModal colaborador={expediente as ColaboradorCompleto} onClose={() => setExpediente(null)} onSave={() => { setExpediente(null); loadAll() }} />}
      {deleteTarget && <ConfirmDeleteColaborador colaborador={deleteTarget} propinasCount={propinas.filter(p => p.colaborador_id === deleteTarget.id).length} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); loadAll() }} />}
    </AppLayout>
  )
}

function HotelColModal({ colaborador, hotelId, nombreNegocio, onClose, onSave }: { colaborador: Colaborador | null; hotelId: string; nombreNegocio: string; onClose: () => void; onSave: () => void }) {
  const [nombre, setNombre] = useState(colaborador?.nombre ?? '')
  const [puesto, setPuesto] = useState(colaborador?.puesto ?? '')
  const [link, setLink] = useState(colaborador?.link_unico ?? '')
  const [linkManual, setLinkManual] = useState(false)
  const [activo, setActivo] = useState(colaborador?.activo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Mientras el enlace no se edite a mano, se genera con nombre + negocio
  function handleNombre(v: string) {
    setNombre(v)
    if (!colaborador && !linkManual) setLink(linkColaborador(v, nombreNegocio))
  }

  async function handleSave() {
    if (!nombre.trim() || (!colaborador && !link.trim())) { setError('Nombre y link son requeridos'); return }
    setSaving(true); setError('')
    try {
      if (colaborador) {
        // El enlace de un colaborador existente no cambia: la pulsera NFC ya programada depende de él
        const { error: err } = await supabase.from('colaboradores').update({ nombre: nombre.trim(), puesto: puesto.trim() || null, activo }).eq('id', colaborador.id)
        if (err) { setError(err.message); return }
      } else {
        const res = await insertarColaborador({ nombre: nombre.trim(), puesto: puesto.trim() || null, hotel_id: hotelId, activo: true }, link.trim(), linkManual)
        if (res.error) { setError(res.error); return }
      }
      onSave()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }
  return (
    <Modal title={colaborador ? 'Editar colaborador' : 'Nuevo colaborador'} onClose={onClose}>
      <FormField label="Nombre completo"><Input value={nombre} onChange={handleNombre} placeholder="Jorge Martínez" /></FormField>
      <FormField label="Puesto"><Input value={puesto} onChange={setPuesto} placeholder="Botones, Spa…" /></FormField>
      {colaborador ? (
        <FormField label="Enlace único NFC" hint="Cambiar este enlace deja de funcionar la pulsera NFC ya programada">
          <span className="tk-link"><span className="tk-link__path">{`${TIP_BASE_URL}/${colaborador.link_unico}`}</span></span>
        </FormField>
      ) : (
        <FormField label="Enlace único NFC" hint={`Se genera con nombre y negocio; puedes editarlo. Dirección de propina: ${TIP_BASE_URL}/${link || '…'}`}>
          <Input value={link} onChange={v => { setLink(v); setLinkManual(true) }} placeholder="jorge-martinez-nombre-negocio" />
        </FormField>
      )}
      {colaborador && <FormField label="Estado"><Select value={activo ? 'activo' : 'inactivo'} onChange={v => setActivo(v === 'activo')}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></Select></FormField>}
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </ModalActions>
    </Modal>
  )
}

function ConfirmDeleteColaborador({ colaborador, propinasCount, onClose, onDeleted }: {
  colaborador: Colaborador; propinasCount: number; onClose: () => void; onDeleted: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setSaving(true); setError('')
    try {
      // Limpia dependencias que bloquean el borrado
      await supabase.from('equipo_miembros').delete().eq('colaborador_id', colaborador.id)
      // RPC: el gerente no puede editar perfiles directamente (RLS); la función valida que sea su negocio
      const { error: desligarError } = await supabase.rpc('desligar_perfil_colaborador', { p_colaborador_id: colaborador.id })
      if (desligarError) console.error('No se pudo desligar el acceso del colaborador:', desligarError)
      const { error: err } = await supabase.from('colaboradores').delete().eq('id', colaborador.id)
      if (err) {
        setError(
          err.code === '23503'
            ? 'No se puede eliminar: el colaborador tiene propinas registradas. Cámbialo a inactivo desde "Editar".'
            : err.message
        )
        return
      }
      onDeleted()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title="Eliminar colaborador" onClose={onClose}>
      <p style={{ marginBottom: 16 }}>
        ¿Seguro que quieres eliminar a <strong>{colaborador.nombre}</strong>? Esta acción no se puede deshacer.
      </p>
      {propinasCount > 0 && (
        <Alert tone="warning">
          Tiene {propinasCount} propina{propinasCount === 1 ? '' : 's'} registrada{propinasCount === 1 ? '' : 's'}.
          Si el historial debe conservarse, mejor cámbialo a <strong>inactivo</strong> desde “Editar”.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="danger" icon="trash" onClick={handleDelete} disabled={saving} loading={saving}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</Btn>
      </ModalActions>
    </Modal>
  )
}

function DockModal({ punto, hotelId, sucursales, sucursalInicial, nombreNegocio, colaboradores, asignados, equipoDisponible, onIrEquipo, onClose, onSaved }: {
  punto: PuntoResena | null; hotelId: string; sucursales: Sucursal[]; sucursalInicial: string | null; nombreNegocio: string
  colaboradores: Colaborador[]; asignados: DockColaborador[]; equipoDisponible: boolean
  onIrEquipo: () => void; onClose: () => void; onSaved: () => void
}) {
  const [nombre, setNombre] = useState(punto?.nombre ?? '')
  const [sucursalId, setSucursalId] = useState(punto?.sucursal_id ?? sucursalInicial ?? sucursales[0]?.id ?? '')
  const [link, setLink] = useState(punto?.link_unico ?? '')
  const [linkManual, setLinkManual] = useState(false)
  const [modo, setModo] = useState<ModoDock>(punto?.modo ?? 'resena')
  const [pregunta, setPregunta] = useState(punto?.pregunta ?? '')
  // Ids elegidos, en el orden en que aparecen en la ventana del cliente
  const [elegidos, setElegidos] = useState<string[]>(() => [...asignados].sort((a, b) => a.orden - b.orden).map(a => a.colaborador_id))
  const [buscar, setBuscar] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [creado, setCreado] = useState<string | null>(null)

  const activos = colaboradores.filter(c => c.activo)
  const hayEquipo = equipoDisponible && activos.length > 0
  const conEquipo = modo !== 'resena'
  const elegidosActivos = elegidos.filter(id => activos.some(c => c.id === id))

  // Mientras el enlace no se edite a mano, se genera con nombre del dock + negocio
  function handleNombre(v: string) {
    setNombre(v)
    if (!punto && !linkManual) setLink(linkColaborador(v, nombreNegocio))
  }

  function toggle(id: string) {
    setError('')
    setElegidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function mover(id: string, dir: -1 | 1) {
    setElegidos(prev => {
      const i = prev.indexOf(id), j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev];[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // Elegidos primero (en su orden), luego el resto por nombre
  const lista = [
    ...elegidos.map(id => colaboradores.find(c => c.id === id)).filter((c): c is Colaborador => !!c),
    ...colaboradores.filter(c => !elegidos.includes(c.id)),
  ]
  const q = buscar.trim().toLowerCase()
  const listaVisible = q ? lista.filter(c => `${c.nombre} ${c.puesto ?? ''}`.toLowerCase().includes(q)) : lista

  async function guardarEquipo(puntoId: string): Promise<string | null> {
    const antes = asignados.map(a => a.colaborador_id)
    const quitar = antes.filter(id => !elegidos.includes(id))
    if (quitar.length) {
      const { error: e } = await supabase.from('dock_colaboradores').delete().eq('punto_id', puntoId).in('colaborador_id', quitar)
      if (e) return e.message
    }
    if (elegidos.length) {
      const filas = elegidos.map((colaborador_id, orden) => ({ punto_id: puntoId, colaborador_id, orden }))
      const { error: e } = await supabase.from('dock_colaboradores').upsert(filas, { onConflict: 'punto_id,colaborador_id' })
      if (e) return e.message
    }
    return null
  }

  async function handleSave() {
    if (!nombre.trim() || (!punto && !link.trim())) { setError('Nombre y enlace son requeridos'); return }
    if (!sucursalId) { setError('Elige una sucursal'); return }
    if (conEquipo && elegidosActivos.length === 0) { setError('Elige al menos una persona activa del equipo, o cambia a “Solo reseña del lugar”.'); return }
    setSaving(true); setError('')
    const p = pregunta.trim()
    const datos = { nombre: nombre.trim(), sucursal_id: sucursalId, modo, pregunta: p && p !== PREGUNTA_DOCK ? p : null }
    try {
      let puntoId = punto?.id ?? null
      let linkFinal = punto?.link_unico ?? ''
      if (punto) {
        // El enlace de un dock existente no cambia: la placa NFC ya programada depende de él
        const { error: err } = await supabase.from('puntos_resena').update(datos).eq('id', punto.id)
        if (err) { setError(err.message); return }
      } else {
        const res = await insertarConLink('puntos_resena', { ...datos, hotel_id: hotelId, activo: true }, link.trim(), linkManual, 'Ya existe un dock con ese enlace')
        if (res.error) { setError(res.error); return }
        puntoId = res.id ?? null
        linkFinal = res.link ?? link.trim()
      }
      // La selección se guarda aunque el modo sea "Solo reseña": al volver a activar el equipo no se pierde
      const cambiosEquipo = elegidos.join() !== [...asignados].sort((a, b) => a.orden - b.orden).map(a => a.colaborador_id).join()
      if (puntoId && cambiosEquipo) {
        const errEquipo = await guardarEquipo(puntoId)
        if (errEquipo) { onSaved(); setError(`El dock se guardó, pero no el equipo: ${errEquipo}`); return }
      }
      onSaved()
      if (punto) onClose()
      else setCreado(linkFinal)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  // Paso siguiente tras crear: programar la placa y probar
  if (creado) {
    const url = `${RESENA_BASE_URL}/${creado}`
    return (
      <Modal title="Dock creado" onClose={onClose}>
        <Alert tone="success">Último paso: programa la placa NFC con este enlace y acércale tu teléfono para probarla.</Alert>
        <FormField label="Enlace para la placa">
          <CopyUrl url={url} />
        </FormField>
        <ModalActions>
          <Btn variant="secondary" icon="external" onClick={() => window.open(url, '_blank', 'noopener')}>Probar como cliente</Btn>
          <Btn onClick={onClose}>Listo</Btn>
        </ModalActions>
      </Modal>
    )
  }

  return (
    <Modal title={punto ? 'Editar dock' : 'Nuevo dock'} onClose={onClose}>
      <SectionHeader title="1. Dónde está" />
      <FormField label="Sucursal">
        <Select value={sucursalId} onChange={setSucursalId}>
          {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Select>
      </FormField>
      <FormField label="Nombre del dock" hint="Ej. Mesa 4, Barra, Recepción">
        <Input value={nombre} onChange={handleNombre} placeholder="Mesa 1" />
      </FormField>
      {punto ? (
        <FormField label="Enlace" hint="Cambiar este enlace deja de funcionar la placa NFC ya programada">
          <span className="tk-link"><span className="tk-link__path">{`${RESENA_BASE_URL}/${punto.link_unico}`}</span></span>
        </FormField>
      ) : (
        <FormField label="Enlace" hint={`Se genera con el nombre del dock y el negocio; puedes editarlo. Dirección: ${RESENA_BASE_URL}/${link || '…'}`}>
          <Input value={link} onChange={v => { setLink(v); setLinkManual(true) }} placeholder="mesa-1-nombre-negocio" />
        </FormField>
      )}

      <SectionHeader title="2. ¿Qué pasa al acercar el teléfono?" />
      <div className="tk-modes" role="radiogroup" aria-label="Qué muestra el dock">
        {MODOS_DOCK.map(m => {
          const bloqueado = m.value !== 'resena' && !hayEquipo && modo !== m.value
          return (
            <label key={m.value} className="tk-mode">
              <input type="radio" name="modo-dock" value={m.value} checked={modo === m.value} disabled={bloqueado} onChange={() => { setModo(m.value); setError('') }} />
              <span>
                <span className="tk-mode__title">{m.label}</span>
                <span className="tk-mode__desc">{m.desc}</span>
              </span>
            </label>
          )
        })}
      </div>
      {!hayEquipo && (
        <Alert tone="info">
          {!equipoDisponible
            ? 'Para mostrar a tu equipo, este negocio necesita el módulo de colaboradores. Pídelo a tak!.'
            : <>Para mostrar a tu equipo primero agrégalo, con foto, en Mi equipo. <Btn small variant="text" onClick={onIrEquipo}>Ir a Mi equipo</Btn></>}
        </Alert>
      )}

      {conEquipo && (
        <>
          <SectionHeader title="3. Quién aparece" />
          <FormField label="Pregunta de la ventana" hint="Déjala vacía para usar la de siempre">
            <Input value={pregunta} onChange={setPregunta} placeholder={PREGUNTA_DOCK} />
          </FormField>
          <div className="tk-pick-bar">
            <span className="tk-pick-bar__count" aria-live="polite">{elegidosActivos.length} de {activos.length} seleccionados</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn small variant="text" onClick={() => setElegidos(prev => [...prev, ...activos.filter(c => !prev.includes(c.id)).map(c => c.id)])}>Todos</Btn>
              <Btn small variant="text" onClick={() => setElegidos([])}>Ninguno</Btn>
            </div>
          </div>
          {colaboradores.length > 6 && (
            <FormField label="Buscar en el equipo">
              <Input value={buscar} onChange={setBuscar} placeholder="Nombre o puesto" />
            </FormField>
          )}
          <div className="tk-picklist">
            {listaVisible.length === 0 && <p className="tk-muted" style={{ padding: 16 }}>Nadie coincide con la búsqueda</p>}
            {listaVisible.map(c => {
              const on = elegidos.includes(c.id)
              const idx = elegidos.indexOf(c.id)
              return (
                <div key={c.id} className="tk-pick" data-off={!c.activo || undefined}>
                  <label>
                    <input type="checkbox" checked={on} disabled={!c.activo && !on} onChange={() => toggle(c.id)} />
                    <Avatar name={c.nombre} src={c.foto_url} size={36} />
                    <span className="tk-pick__text">
                      <span className="tk-pick__name">{c.nombre}</span>
                      <span className="tk-pick__role">
                        {[c.puesto, !c.activo ? 'Inactivo: no se muestra' : !c.foto_url ? 'Sin foto' : null].filter(Boolean).join(' · ') || ' '}
                      </span>
                    </span>
                  </label>
                  {on && !q && (
                    <span className="tk-pick__order">
                      {idx > 0 && <IconBtn small icon="chevronUp" label={`Subir a ${c.nombre}`} onClick={() => mover(c.id, -1)} />}
                      {idx < elegidos.length - 1 && <IconBtn small icon="chevronDown" label={`Bajar a ${c.nombre}`} onClick={() => mover(c.id, 1)} />}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {error && <div style={{ marginTop: 16 }}><Alert>{error}</Alert></div>}
      <ModalActions>
        {punto && <Btn variant="text" icon="external" onClick={() => window.open(`${RESENA_BASE_URL}/${punto.link_unico}`, '_blank', 'noopener')}>Probar como cliente</Btn>}
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : punto ? 'Guardar' : 'Crear dock'}</Btn>
      </ModalActions>
    </Modal>
  )
}

function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="tk-link">
      <span className="tk-link__path" title={url}>{url.replace(/^https?:\/\//, '')}</span>
      <IconBtn small icon={copied ? 'check' : 'copy'} label={copied ? 'Enlace copiado' : 'Copiar enlace'} onClick={handleCopy} className={copied ? 'is-done' : undefined} />
    </span>
  )
}

// ─── CopyLink ─────────────────────────────────────────────────────────────────

function CopyLink({ linkUnico }: { linkUnico: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${TIP_BASE_URL}/${linkUnico}`

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="tk-link">
      <span className="tk-link__path" title={url}>/tip/{linkUnico}</span>
      <IconBtn small icon={copied ? 'check' : 'copy'} label={copied ? 'Enlace copiado' : 'Copiar enlace de propina'} onClick={handleCopy} className={copied ? 'is-done' : undefined} />
      <span className="tk-sr" aria-live="polite">{copied ? 'Enlace copiado' : ''}</span>
    </span>
  )
}
