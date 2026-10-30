import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { getInitials, formatMXN } from '@/lib/utils'
import { exportCSV, formatDateFull } from '@/lib/export'
import { useRealtimePropinas } from '@/lib/realtime'
import { fetchResenas, type Resena } from '@/lib/resenas'
import { Toast } from '@/components/UI'
import { ColaboradorAvatar } from '@/components/ExpedienteModal'
import {
  AppLayout, SubpageLayout, PageContent, PageHeader, SectionHeader, Card, KpiRow, KpiCard,
  Table, Tr, Td, StatusBadge, Badge, Btn, EmptyState, Stars, FullscreenLoader, LiveIndicator,
} from '@/components/UI'
import { Icon } from '@/components/Icon'
import { TrendBars, RatingBreakdown, KpiSpark } from '@/components/Stats'

type Colaborador = { id: string; nombre: string; puesto: string | null; foto_url: string | null; hotel_id: string; telefono: string | null; fecha_ingreso: string | null }
type Hotel = { nombre: string; tipo: string | null }
type Propina = { id: string; monto_total: number; estado: string; created_at: string }
type Tab = 'resumen' | 'historial' | 'resenas'
type FiltroEstrellas = 'todas' | '5' | '4' | 'bajas'
type FiltroComentario = 'todas' | 'mensaje' | 'calificacion' | 'bajas' | 'altas'

const PAGE_SIZE = 50

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso))
}
function promedioPonderado(resenas: Resena[]) {
  const con = resenas.filter(r => r.estrellas !== null)
  if (!con.length) return 0
  return con.reduce((s, r) => s + (r.estrellas ?? 0), 0) / con.length
}

const NAV = [
  { id: 'resumen', label: 'Resumen', icon: 'resumen' },
  { id: 'historial', label: 'Historial', icon: 'history' },
  { id: 'resenas', label: 'Reseñas', icon: 'star' },
]

type Props = { linkId: string; useId?: boolean; onBack?: () => void }

export function ColaboradorDashboard({ linkId, useId = false, onBack }: Props) {
  const { signOut } = useAuth()
  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [propinas, setPropinas] = useState<Propina[]>([])
  const [resenas, setResenas] = useState<Resena[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('resumen')
  const [toast, setToast] = useState<string | null>(null)
  const [filtroEstrellas, setFiltroEstrellas] = useState<FiltroEstrellas>('todas')
  const [filtroComent, setFiltroComent] = useState<FiltroComentario>('todas')
  const [visibleCalif, setVisibleCalif] = useState(PAGE_SIZE)
  const [visibleComent, setVisibleComent] = useState(PAGE_SIZE)

  useEffect(() => { load() }, [linkId])

  useRealtimePropinas(colaborador?.id ?? null, (monto) => {
    setToast(`¡Recibiste una propina de ${formatMXN(monto)}!`)
    load()
  })

  async function load() {
    setLoading(true)
    const query = supabase.from('colaboradores').select('*').eq('activo', true)
    const { data: col, error } = await (useId ? query.eq('id', linkId) : query.eq('link_unico', linkId)).single()
    if (error || !col) { setNotFound(true); setLoading(false); return }
    setColaborador(col as Colaborador)
    const [{ data: hotelData }, { data: propinasData }, resenasData] = await Promise.all([
      supabase.from('hotels').select('nombre, tipo').eq('id', col.hotel_id).single(),
      supabase.from('propinas').select('*').eq('colaborador_id', col.id).order('created_at', { ascending: false }),
      fetchResenas({ colaborador_id: col.id }),
    ])
    setHotel(hotelData as Hotel)
    setPropinas((propinasData as Propina[]) ?? [])
    setResenas(await fetchResenas({ colaborador_id: col.id }, ((propinasData as Propina[]) ?? []).map(p => p.id)))
    setLoading(false)
  }

  function exportarHistorial() {
    exportCSV(`historial-${colaborador?.nombre ?? 'colaborador'}`,
      ['Monto', 'Estado', 'Fecha'],
      propinas.map(p => [p.monto_total, p.estado, formatDateFull(p.created_at)])
    )
  }

  const totalRecibido = propinas.reduce((s, p) => s + p.monto_total, 0)
  const promedioTip = propinas.length ? totalRecibido / propinas.length : 0
  const calificacion = promedioPonderado(resenas)
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const propinasEsteMes = propinas.filter(p => new Date(p.created_at) >= inicioMes)
  const totalMes = propinasEsteMes.reduce((s, p) => s + p.monto_total, 0)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split('T')[0]
    const label = d.toLocaleDateString('es-MX', { weekday: 'short' })
    const total = propinas.filter(p => p.created_at.startsWith(key)).reduce((s, p) => s + p.monto_total, 0)
    return { label, total }
  })
  const maxBar = Math.max(...last7.map(d => d.total), 1)

  if (notFound) return (
    <div className="tk-fullscreen">
      <EmptyState icon="users" title="Colaborador no encontrado" text="Este perfil no existe o está inactivo."
        action={onBack
          ? <Btn variant="secondary" icon="back" onClick={onBack}>Volver</Btn>
          : <Btn variant="secondary" icon="logout" onClick={signOut}>Cerrar sesión</Btn>}
      />
    </div>
  )

  if (!colaborador || loading) return <FullscreenLoader />

  const conEstrellas = resenas.filter(r => r.estrellas !== null).length
  const conTexto = resenas.filter(r => r.comentario?.trim()).length
  const califFiltradas = resenas.filter(r => {
    if (r.estrellas === null) return false
    if (filtroEstrellas === 'todas') return true
    if (filtroEstrellas === 'bajas') return r.estrellas <= 3
    return r.estrellas === Number(filtroEstrellas)
  })
  const comentFiltrados = resenas.filter(r => {
    if (!r.comentario?.trim()) return false
    if (filtroComent === 'mensaje') return r.estrellas === null
    if (filtroComent === 'calificacion') return r.estrellas !== null
    if (filtroComent === 'bajas') return r.estrellas !== null && r.estrellas <= 3
    if (filtroComent === 'altas') return r.estrellas !== null && r.estrellas >= 4
    return true
  })

  const mainContent = (
    <PageContent>
      {/* ══ RESUMEN ══ */}
      {tab === 'resumen' && (
        <>
          <div className="tk-profile">
            <ColaboradorAvatar col={colaborador} size={72} />
            <div style={{ minWidth: 0 }}>
              <h1 className="tk-profile__name">{colaborador.nombre}</h1>
              <div className="tk-profile__meta">
                <span><Icon name="building" />{[colaborador.puesto, hotel?.nombre].filter(Boolean).join(' · ')}</span>
                {colaborador.fecha_ingreso && (
                  <span><Icon name="calendar" />Desde {new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(colaborador.fecha_ingreso + 'T12:00:00'))}</span>
                )}
                {colaborador.telefono && (
                  <span><Icon name="phone" />{colaborador.telefono}</span>
                )}
                {calificacion > 0 && (
                  <span><Stars value={Math.round(calificacion)} /><strong style={{ color: 'var(--text)' }}>{calificacion.toFixed(1)}</strong> ({conEstrellas} reseñas)</span>
                )}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}><LiveIndicator /></div>
          </div>
          <KpiRow>
            <KpiCard featured label="Este mes" value={formatMXN(totalMes)} sub={`${propinasEsteMes.length} propinas`} icon="tip"><KpiSpark values={last7.map(d => d.total)} /></KpiCard>
            <KpiCard label="Total recibido" value={formatMXN(totalRecibido)} sub={`${propinas.length} en total`} icon="trend" />
            <KpiCard label="Promedio" value={propinas.length ? formatMXN(promedioTip) : '—'} sub="por propina" icon="chart" />
            <KpiCard label="Calificación" value={calificacion > 0 ? calificacion.toFixed(1) : '—'} sub="de 5 estrellas" icon="star" />
          </KpiRow>
          <Card title="Tus propinas de los últimos 7 días" meta="Monto recibido por día">
            <TrendBars data={last7} label="Propinas de los últimos 7 días" format={n => formatMXN(n).replace('MX$', '$')} />
          </Card>
          <div style={{ marginTop: 32 }}>
            <SectionHeader title="Propinas recientes" action={propinas.length > 5 ? <Btn small variant="text" icon="history" onClick={() => setTab('historial')}>Ver historial</Btn> : undefined} />
            {propinas.length === 0 ? (
              <EmptyState icon="tip" title="Aún no tienes propinas registradas" text="Cuando un huésped toque tu pulsera tak! y deje propina, la verás aquí al instante." />
            ) : (
              <Table headers={['Monto', 'Estado', 'Fecha']} numCols={[0]}>
                {propinas.slice(0, 5).map(p => (
                  <Tr key={p.id}>
                    <Td right bold>{formatMXN(p.monto_total)}</Td>
                    <Td><StatusBadge estado={p.estado} /></Td>
                    <Td muted nowrap>{formatDateShort(p.created_at)}</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </div>
        </>
      )}

      {/* ══ HISTORIAL ══ */}
      {tab === 'historial' && (
        <>
          <PageHeader title="Historial completo" subtitle={`${propinas.length} propinas · ${formatMXN(totalRecibido)} en total`} action={<Btn variant="secondary" icon="download" onClick={exportarHistorial}>Exportar CSV</Btn>} />
          {propinas.length === 0 ? (
            <EmptyState icon="tip" title="Aún no tienes propinas registradas" />
          ) : (
            <Table headers={['Monto', 'Estado', 'Fecha']} numCols={[0]}>
              {propinas.map(p => (
                <Tr key={p.id}>
                  <Td right bold>{formatMXN(p.monto_total)}</Td>
                  <Td><StatusBadge estado={p.estado} /></Td>
                  <Td muted nowrap>{formatDate(p.created_at)}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </>
      )}

      {/* ══ RESEÑAS ══ */}
      {tab === 'resenas' && (
        <>
          <PageHeader title="Mis reseñas" subtitle="Lo que dicen los huéspedes de ti" />
          <KpiRow>
            <KpiCard featured label="Calificación promedio" value={calificacion > 0 ? calificacion.toFixed(1) : '—'} sub="de 5 estrellas" icon="star" />
            <KpiCard label="Calificaciones" value={String(conEstrellas)} sub="con estrellas" icon="history" />
            <KpiCard label="Comentarios" value={String(conTexto)} sub="con texto" icon="message" />
          </KpiRow>

          <div style={{ marginTop: 32 }}>
            <Card title="Calificaciones" meta={`${califFiltradas.length} ${califFiltradas.length === 1 ? 'calificación' : 'calificaciones'}`}>
              {conEstrellas === 0 ? (
                <EmptyState inline icon="star" title="Aún no hay calificaciones" text="Aparecerán aquí en cuanto los huéspedes te califiquen con estrellas." />
              ) : (
                <>
                  <RatingBreakdown value={calificacion} rows={[5, 4, 3, 2, 1].map(star => ({ star, count: resenas.filter(r => r.estrellas === star).length }))} />
                  <div className="tk-toolbar" style={{ marginTop: 16 }}>
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
                      <Table headers={['Estrellas', 'Estado', 'Fecha']}>
                        {califFiltradas.slice(0, visibleCalif).map(r => (
                          <Tr key={r.id}>
                            <Td><Stars value={r.estrellas ?? 0} /></Td>
                            <Td><Badge text={r.publica ? 'Enviada a Google' : 'Interna'} tone={r.publica ? 'success' : 'neutral'} /></Td>
                            <Td muted nowrap>{formatDateShort(r.created_at)}</Td>
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
              {conTexto === 0 ? (
                <EmptyState inline icon="message" title="Aún no hay comentarios" text="Los mensajes que te dejen los huéspedes, con o sin calificación, aparecerán aquí." />
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
                      <Table headers={['Calificación', 'Comentario', 'Estado', 'Fecha']}>
                        {comentFiltrados.slice(0, visibleComent).map(r => (
                          <Tr key={r.id}>
                            <Td>{r.estrellas ? <Stars value={r.estrellas} /> : <span className="tk-muted">Solo mensaje</span>}</Td>
                            <Td wrap>{r.comentario?.trim()}</Td>
                            <Td><Badge text={r.publica ? 'Enviada a Google' : 'Interna'} tone={r.publica ? 'success' : 'neutral'} /></Td>
                            <Td muted nowrap>{formatDateShort(r.created_at)}</Td>
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
    </PageContent>
  )

  // Modo embebido — viene desde gerente o admin
  if (onBack) {
    return (
      <>
        <SubpageLayout
          onBack={onBack}
          title={colaborador.nombre}
          meta={colaborador.puesto ?? undefined}
          avatar={<ColaboradorAvatar col={colaborador} size={36} />}
          tabs={NAV} activeTab={tab} onTabChange={id => setTab(id as Tab)}
        >
          {mainContent}
        </SubpageLayout>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </>
    )
  }

  return (
    <AppLayout navItems={NAV} activeTab={tab} onTabChange={id => setTab(id as Tab)} title="Mi panel" subtitle={[colaborador.puesto, hotel?.nombre].filter(Boolean).join(' · ')}>
      {mainContent}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </AppLayout>
  )
}
