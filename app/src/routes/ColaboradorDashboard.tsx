import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { getInitials, formatMXN } from '@/lib/utils'
import { exportCSV, formatDateFull } from '@/lib/export'
import { useRealtimePropinas } from '@/lib/realtime'
import { Toast } from '@/components/UI'
import { ColaboradorAvatar } from '@/components/ExpedienteModal'
import {
  AppLayout, SubpageLayout, PageContent, PageHeader, SectionHeader, Card, KpiRow, KpiCard,
  Table, Tr, Td, StatusBadge, Btn, EmptyState, BarChart, RatingDistribution, Stars, FullscreenLoader, LiveIndicator,
} from '@/components/UI'
import { Icon } from '@/components/Icon'

type Colaborador = { id: string; nombre: string; puesto: string | null; foto_url: string | null; hotel_id: string; telefono: string | null; fecha_ingreso: string | null }
type Hotel = { nombre: string }
type Propina = { id: string; monto_total: number; estado: string; created_at: string }
type Resena = { id: string; propina_id: string; estrellas: number | null; comentario: string | null; created_at: string }
type Tab = 'resumen' | 'historial' | 'resenas'

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
    const [{ data: hotelData }, { data: propinasData }, propinasForResenas] = await Promise.all([
      supabase.from('hotels').select('nombre').eq('id', col.hotel_id).single(),
      supabase.from('propinas').select('*').eq('colaborador_id', col.id).order('created_at', { ascending: false }),
      supabase.from('propinas').select('id').eq('colaborador_id', col.id),
    ])
    setHotel(hotelData as Hotel)
    setPropinas((propinasData as Propina[]) ?? [])
    const propIds = (propinasForResenas.data ?? []).map((p: any) => p.id)
    if (propIds.length > 0) {
      const { data: resData } = await supabase.from('resenas').select('*').in('propina_id', propIds).order('created_at', { ascending: false })
      setResenas((resData as Resena[]) ?? [])
    }
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

  const conEstrellas = resenas.filter(r => r.estrellas).length

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
            <KpiCard featured label="Este mes" value={formatMXN(totalMes)} sub={`${propinasEsteMes.length} propinas`} icon="tip" />
            <KpiCard label="Total recibido" value={formatMXN(totalRecibido)} sub={`${propinas.length} en total`} icon="trend" />
            <KpiCard label="Promedio" value={propinas.length ? formatMXN(promedioTip) : '—'} sub="por propina" icon="chart" />
            <KpiCard label="Calificación" value={calificacion > 0 ? calificacion.toFixed(1) : '—'} sub="de 5 estrellas" icon="star" />
          </KpiRow>
          <Card title="Tus propinas de los últimos 7 días" meta="Monto recibido por día">
            <BarChart data={last7} label="Propinas de los últimos 7 días" format={n => formatMXN(n).replace('MX$', '$')} />
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
          {calificacion > 0 && (
            <Card>
              <div className="tk-scorebox">
                <div className="tk-scorebox__big">
                  <p className="tk-scorebox__num">{calificacion.toFixed(1)}</p>
                  <Stars value={Math.round(calificacion)} />
                  <p className="tk-muted" style={{ font: 'var(--t-small)', marginTop: 4 }}>{conEstrellas} reseñas</p>
                </div>
                <RatingDistribution rows={[5, 4, 3, 2, 1].map(star => {
                  const count = resenas.filter(r => r.estrellas === star).length
                  const pct = resenas.filter(r => r.estrellas).length ? count / resenas.filter(r => r.estrellas).length : 0
                  return { star, count, pct }
                })} />
              </div>
            </Card>
          )}
          <div style={{ marginTop: 32 }}>
            <SectionHeader title="Comentarios" />
            {resenas.filter(r => r.comentario?.trim()).length === 0 ? (
              <EmptyState icon="message" title="Aún no tienes comentarios" text="Los mensajes que te dejen los huéspedes aparecerán aquí." />
            ) : (
              <Table headers={['Calificación', 'Comentario', 'Fecha']}>
                {resenas.filter(r => r.comentario?.trim()).map(r => (
                  <Tr key={r.id}>
                    <Td>{r.estrellas ? <Stars value={r.estrellas} /> : <span className="tk-muted">Solo mensaje</span>}</Td>
                    <Td wrap>{r.comentario}</Td>
                    <Td muted nowrap>{formatDateShort(r.created_at)}</Td>
                  </Tr>
                ))}
              </Table>
            )}
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
