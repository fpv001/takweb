import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { getInitials, formatMXN } from '@/lib/utils'
import { crearUsuario } from '@/lib/edgeFunctions'
import { exportCSV, formatDateFull } from '@/lib/export'
import { useRealtimeHotel } from '@/lib/realtime'
import { EquiposPanel } from '@/components/EquiposPanel'
import { ColaboradorDashboard } from '@/routes/ColaboradorDashboard'
import { ExpedienteModal, ColaboradorAvatar, type ColaboradorCompleto } from '@/components/ExpedienteModal'
import { Toast } from '@/components/UI'
import {
  AppLayout, SubpageLayout, PageContent, PageHeader, SectionHeader, Card, KpiRow, KpiCard,
  Table, Tr, Td, StatusBadge, ActiveBadge, Btn, IconBtn, Modal, ModalActions, FormField, Input, Select, Spinner,
  Avatar, Alert, EmptyState, LiveIndicator, BarChart, RatingDistribution, Stars, FullscreenLoader,
} from '@/components/UI'
import { Icon } from '@/components/Icon'

type Hotel = { id: string; nombre: string; stripe_api_key: string | null; google_place_id: string | null }
type Colaborador = { id: string; nombre: string; puesto: string | null; activo: boolean; link_unico: string; created_at: string; foto_url: string | null; telefono: string | null; fecha_ingreso: string | null; notas: string | null; hotel_id: string }
type Propina = { id: string; monto_total: number; estado: string; colaborador_id: string; created_at: string }
type Resena = { id: string; propina_id: string; estrellas: number | null; comentario: string | null; created_at: string }
type Tab = 'resumen' | 'equipo' | 'propinas' | 'resenas' | 'equipos' | 'leaderboard' | 'configuracion'

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
  { id: 'equipos', label: 'Repartos', icon: 'split' },
  { id: 'leaderboard', label: 'Ranking', icon: 'trophy' },
  { id: 'configuracion', label: 'Configuración', icon: 'settings' },
]

type Props = { hotelId: string; onBack?: () => void }

export function HotelDashboard({ hotelId, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('resumen')
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [propinas, setPropinas] = useState<Propina[]>([])
  const [resenas, setResenas] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [colModal, setColModal] = useState<Colaborador | 'new' | null>(null)
  const [usuarioModal, setUsuarioModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [colDetalle, setColDetalle] = useState<string | null>(null)
  const [expediente, setExpediente] = useState<Colaborador | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Colaborador | null>(null)
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [savingGoogle, setSavingGoogle] = useState(false)

  useEffect(() => { loadAll() }, [hotelId])

  useRealtimeHotel(hotelId, (monto, colaboradorId) => {
    const col = colaboradores.find(c => c.id === colaboradorId)
    setToast(`Nueva propina de ${formatMXN(monto)}${col ? ` para ${col.nombre}` : ''}`)
    loadAll()
  })

  // Drill-down colaborador
  if (colDetalle) {
    return <ColaboradorDashboard linkId={colDetalle} useId onBack={() => setColDetalle(null)} />
  }

  async function loadAll() {
    setLoading(true)
    const [{ data: h }, { data: cols }, { data: props }] = await Promise.all([
      supabase.from('hotels').select('*').eq('id', hotelId).single(),
      supabase.from('colaboradores').select('*').eq('hotel_id', hotelId).order('nombre'),
      supabase.from('propinas').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false }),
    ])
    const hotelData = h as Hotel
    setHotel(hotelData)
    setGooglePlaceId(hotelData?.google_place_id ?? '')
    setColaboradores((cols as Colaborador[]) ?? [])
    setPropinas((props as Propina[]) ?? [])
    const propIds = ((props as Propina[]) ?? []).map(p => p.id)
    if (propIds.length > 0) {
      const { data: res } = await supabase.from('resenas').select('*').in('propina_id', propIds).order('created_at', { ascending: false })
      setResenas((res as Resena[]) ?? [])
    }
    setLoading(false)
  }

  function exportarPropinas() {
    exportCSV(`propinas-${hotel?.nombre ?? 'hotel'}`,
      ['Colaborador', 'Puesto', 'Monto', 'Estado', 'Fecha'],
      propinas.map(p => {
        const col = colaboradores.find(c => c.id === p.colaborador_id)
        return [col?.nombre ?? '—', col?.puesto ?? '—', p.monto_total, p.estado, formatDateFull(p.created_at)]
      })
    )
  }

  async function saveGooglePlaceId() {
    if (!googlePlaceId.trim()) {
      setToast('Ingresa un Google Place ID válido')
      return
    }
    setSavingGoogle(true)
    try {
      const { error } = await supabase
        .from('hotels')
        .update({ google_place_id: googlePlaceId.trim() })
        .eq('id', hotelId)
      if (error) {
        setToast('No se pudo guardar: ' + error.message)
      } else {
        setToast('Google Place ID guardado')
        setHotel(hotel ? { ...hotel, google_place_id: googlePlaceId.trim() } : null)
      }
    } catch (err) {
      setToast('Ocurrió un error inesperado. Intenta de nuevo.')
    } finally {
      setSavingGoogle(false)
    }
  }

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
      <EmptyState icon="hotel" title="Hotel no encontrado" text="Puede que se haya eliminado o que tu cuenta ya no tenga acceso." action={onBack ? <Btn variant="secondary" icon="back" onClick={onBack}>Volver</Btn> : undefined} />
    </div>
  )

  const mainContent = (
    <PageContent>
      {loading ? <Spinner /> : (
        <>
          {/* ══ RESUMEN ══ */}
          {tab === 'resumen' && (
            <>
              <PageHeader title={hotel?.nombre ?? ''} subtitle="Así va tu hotel hoy" action={<LiveIndicator label="Propinas en vivo" />} />
              <KpiRow>
                <KpiCard featured label="Este mes" value={formatMXN(totalMes)} sub={`${propinasMes.length} propinas`} icon="tip" />
                <KpiCard label="Total histórico" value={formatMXN(totalPropinas)} sub={`${propinas.length} propinas`} icon="trend" />
                <KpiCard label="Calificación" value={calificacion > 0 ? calificacion.toFixed(1) : '—'} sub={`${resenasConEstrellas.length} reseñas`} icon="star" />
                <KpiCard label="Equipo activo" value={String(colaboradores.filter(c => c.activo).length)} sub="colaboradores" icon="users" />
              </KpiRow>
              <div className="tk-grid-main">
                <Card title="Propinas de los últimos 7 días" meta="Monto recibido por día">
                  <BarChart data={last7} label="Propinas de los últimos 7 días" format={n => formatMXN(n).replace('MX$', '$')} />
                </Card>
                <Card title="Top colaboradores" meta="Por monto recibido">
                  {topCols.length === 0 ? (
                    <EmptyState inline icon="users" title="Sin datos aún" />
                  ) : (
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
                    <Btn variant="secondary" icon="key" onClick={() => setUsuarioModal(true)}>Crear acceso</Btn>
                    <Btn icon="plus" onClick={() => setColModal('new')}>Nuevo colaborador</Btn>
                  </>
                }
              />
              {colaboradores.length === 0 ? (
                <EmptyState icon="users" title="Aún no hay colaboradores en este hotel" text="Agrega a tu equipo para generar el enlace NFC de cada pulsera." action={<Btn icon="plus" onClick={() => setColModal('new')}>Nuevo colaborador</Btn>} />
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
              <PageHeader title="Propinas" subtitle="Historial de todas las propinas del hotel" action={<Btn variant="secondary" icon="download" onClick={exportarPropinas}>Exportar CSV</Btn>} />
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
              <PageHeader title="Reseñas" subtitle="Lo que opinan los huéspedes de tu equipo" />
              <KpiRow>
                <KpiCard featured label="Calificación promedio" value={calificacion > 0 ? calificacion.toFixed(1) : '—'} sub="de 5 estrellas" icon="star" />
                <KpiCard label="Total de reseñas" value={String(resenasConEstrellas.length)} icon="history" />
                <KpiCard label="Con comentario" value={String(resenas.filter(r => r.comentario?.trim()).length)} icon="message" />
              </KpiRow>
              {resenasConEstrellas.length > 0 && (
                <Card title="Distribución de calificaciones">
                  <RatingDistribution rows={[5, 4, 3, 2, 1].map(star => {
                    const count = resenas.filter(r => r.estrellas === star).length
                    const pct = resenasConEstrellas.length ? count / resenasConEstrellas.length : 0
                    return { star, count, pct }
                  })} />
                </Card>
              )}
              <div style={{ marginTop: 32 }}>
                <SectionHeader title="Comentarios" />
                {resenas.filter(r => r.comentario?.trim()).length === 0 ? (
                  <EmptyState icon="message" title="Aún no hay comentarios de huéspedes" text="Los comentarios que dejen junto con su reseña aparecerán aquí." />
                ) : (
                  <Table headers={['Colaborador', 'Calificación', 'Comentario', 'Fecha']}>
                    {resenas.filter(r => r.comentario?.trim()).map(r => {
                      const propina = propinas.find(p => p.id === r.propina_id)
                      const col = colaboradores.find(c => c.id === propina?.colaborador_id)
                      return (
                        <Tr key={r.id}>
                          <Td bold>{col?.nombre ?? '—'}</Td>
                          <Td>{r.estrellas ? <Stars value={r.estrellas} /> : '—'}</Td>
                          <Td wrap>{r.comentario}</Td>
                          <Td muted nowrap>{formatDate(r.created_at)}</Td>
                        </Tr>
                      )
                    })}
                  </Table>
                )}
              </div>
            </>
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
              const propIds = propinas.filter(p => p.colaborador_id === c.id).map(p => p.id)
              const resCol = resenas.filter(r => propIds.includes(r.propina_id) && r.estrellas)
              const promedio = resCol.length ? resCol.reduce((s, r) => s + (r.estrellas ?? 0), 0) / resCol.length : 0
              const totalP = propinas.filter(p => p.colaborador_id === c.id).reduce((s, p) => s + p.monto_total, 0)
              return { ...c, promedio, totalResenas: resCol.length, totalP }
            }).filter(c => c.totalResenas > 0).sort((a, b) => b.promedio - a.promedio || b.totalResenas - a.totalResenas)
            const sinResenas = colaboradores.filter(c => {
              const propIds = propinas.filter(p => p.colaborador_id === c.id).map(p => p.id)
              return resenas.filter(r => propIds.includes(r.propina_id) && r.estrellas).length === 0
            })
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
              <PageHeader title="Configuración" subtitle="Ajustes de tu hotel" />
              <Card title="Reseñas en Google" meta="Las reseñas de 4 y 5 estrellas pueden publicarse en el perfil de Google de tu hotel.">
                <div style={{ maxWidth: 560, marginTop: 8 }}>
                  <FormField label="Google Place ID" hint="Encuéntralo en Google Maps. Es necesario para enviar a los huéspedes a dejar su reseña en Google.">
                    <Input value={googlePlaceId} onChange={setGooglePlaceId} placeholder="ChIJ…" />
                  </FormField>
                  <Btn onClick={saveGooglePlaceId} disabled={savingGoogle} loading={savingGoogle}>
                    {savingGoogle ? 'Guardando…' : 'Guardar'}
                  </Btn>
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
          meta="Panel del hotel"
          avatar={<Avatar name={hotel?.nombre ?? '?'} size={36} />}
          tabs={NAV} activeTab={tab} onTabChange={id => setTab(id as Tab)}
        >
          {mainContent}
        </SubpageLayout>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        {colModal !== null && <HotelColModal colaborador={colModal === 'new' ? null : colModal} hotelId={hotelId} onClose={() => setColModal(null)} onSave={() => { setColModal(null); loadAll() }} />}
        {usuarioModal && <CrearAccesoModal hotelId={hotelId} colaboradores={colaboradores} onClose={() => setUsuarioModal(false)} onSave={() => setUsuarioModal(false)} />}
        {expediente && <ExpedienteModal colaborador={expediente as ColaboradorCompleto} onClose={() => setExpediente(null)} onSave={() => { setExpediente(null); loadAll() }} />}
        {deleteTarget && <ConfirmDeleteColaborador colaborador={deleteTarget} propinasCount={propinas.filter(p => p.colaborador_id === deleteTarget.id).length} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); loadAll() }} />}
      </>
    )
  }

  return (
    <AppLayout navItems={NAV} activeTab={tab} onTabChange={id => setTab(id as Tab)} title={hotel?.nombre ?? 'Mi hotel'} subtitle="Panel de gerencia">
      {mainContent}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      {colModal !== null && <HotelColModal colaborador={colModal === 'new' ? null : colModal} hotelId={hotelId} onClose={() => setColModal(null)} onSave={() => { setColModal(null); loadAll() }} />}
      {usuarioModal && <CrearAccesoModal hotelId={hotelId} colaboradores={colaboradores} onClose={() => setUsuarioModal(false)} onSave={() => setUsuarioModal(false)} />}

      {expediente && <ExpedienteModal colaborador={expediente as ColaboradorCompleto} onClose={() => setExpediente(null)} onSave={() => { setExpediente(null); loadAll() }} />}
      {deleteTarget && <ConfirmDeleteColaborador colaborador={deleteTarget} propinasCount={propinas.filter(p => p.colaborador_id === deleteTarget.id).length} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); loadAll() }} />}
    </AppLayout>
  )
}

function HotelColModal({ colaborador, hotelId, onClose, onSave }: { colaborador: Colaborador | null; hotelId: string; onClose: () => void; onSave: () => void }) {
  const [nombre, setNombre] = useState(colaborador?.nombre ?? '')
  const [puesto, setPuesto] = useState(colaborador?.puesto ?? '')
  const [link, setLink] = useState(colaborador?.link_unico ?? '')
  const [activo, setActivo] = useState(colaborador?.activo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function slugify(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
  async function handleSave() {
    if (!nombre.trim() || !link.trim()) { setError('Nombre y link son requeridos'); return }
    setSaving(true); setError('')
    try {
      const { error: err } = colaborador
        ? await supabase.from('colaboradores').update({ nombre: nombre.trim(), puesto: puesto.trim() || null, link_unico: link.trim(), activo }).eq('id', colaborador.id)
        : await supabase.from('colaboradores').insert({ nombre: nombre.trim(), puesto: puesto.trim() || null, hotel_id: hotelId, link_unico: link.trim(), activo: true })
      if (err) {
        setError(err.code === '23505' ? 'Ya existe un colaborador con ese link único' : err.message)
        return
      }
      onSave()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }
  return (
    <Modal title={colaborador ? 'Editar colaborador' : 'Nuevo colaborador'} onClose={onClose}>
      <FormField label="Nombre completo"><Input value={nombre} onChange={v => { setNombre(v); if (!colaborador) setLink(slugify(v)) }} placeholder="Jorge Martínez" /></FormField>
      <FormField label="Puesto"><Input value={puesto} onChange={setPuesto} placeholder="Botones, Spa…" /></FormField>
      <FormField label="Enlace único NFC" hint={`Dirección de propina: ${TIP_BASE_URL}/${link || '…'}`}><Input value={link} onChange={setLink} placeholder="jorge-martinez" /></FormField>
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
      await supabase.from('perfiles').update({ colaborador_id: null }).eq('colaborador_id', colaborador.id)
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

function CrearAccesoModal({ hotelId, colaboradores, onClose, onSave }: { hotelId: string; colaboradores: Colaborador[]; onClose: () => void; onSave: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [colaboradorId, setColaboradorId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function handleSave() {
    if (!email.trim() || !password.trim()) { setError('Email y contraseña son requeridos'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (!colaboradorId) { setError('Selecciona el colaborador'); return }
    setSaving(true); setError('')
    const { crearUsuario } = await import('@/lib/edgeFunctions')
    const err = await crearUsuario({ email: email.trim(), password, rol: 'colaborador', hotel_id: hotelId, colaborador_id: colaboradorId })
    if (err) { setError(err); setSaving(false); return }
    onSave()
  }
  return (
    <Modal title="Crear acceso para colaborador" onClose={onClose}>
      <FormField label="Colaborador" hint="El colaborador entrará a su propio panel con este acceso."><Select value={colaboradorId} onChange={setColaboradorId}><option value="">Selecciona un colaborador</option>{colaboradores.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.puesto ?? 'Sin puesto'}</option>)}</Select></FormField>
      <FormField label="Correo electrónico"><Input value={email} onChange={setEmail} placeholder="correo@ejemplo.com" type="email" inputMode="email" autoComplete="off" /></FormField>
      <FormField label="Contraseña" hint="Mínimo 6 caracteres"><Input value={password} onChange={setPassword} placeholder="••••••••" type="password" autoComplete="new-password" /></FormField>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Creando…' : 'Crear acceso'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── CopyLink ─────────────────────────────────────────────────────────────────

const TIP_BASE_URL = `${import.meta.env.VITE_WEB_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/tip`

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
