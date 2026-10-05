import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getInitials, formatMXN } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { crearUsuario } from '@/lib/edgeFunctions'
import { ExpedienteModal, ColaboradorAvatar, type ColaboradorCompleto } from '@/components/ExpedienteModal'
import { HotelDashboard } from '@/routes/HotelDashboard'
import { exportCSV, formatDateFull } from '@/lib/export'
import {
  AppLayout, PageContent, PageHeader, SectionHeader, KpiRow, KpiCard,
  Table, Tr, Td, Badge, StatusBadge, ActiveBadge, Btn, IconBtn, Modal, ModalActions, FormField, Input, Select, Spinner,
  Avatar, Alert, EmptyState,
} from '@/components/UI'
import { Icon } from '@/components/Icon'

// ─── Types ───────────────────────────────────────────────────────────────────

type Hotel = { id: string; nombre: string; stripe_api_key: string | null; created_at: string }
type Colaborador = { id: string; nombre: string; puesto: string | null; hotel_id: string; activo: boolean; link_unico: string; created_at: string; foto_url: string | null; telefono: string | null; fecha_ingreso: string | null; notas: string | null }
type Propina = { id: string; monto_total: number; estado: string; hotel_id: string; colaborador_id: string; created_at: string }
type Tab = 'resumen' | 'hoteles' | 'colaboradores' | 'propinas'

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
  { id: 'hoteles', label: 'Hoteles', icon: 'hotel' },
  { id: 'colaboradores', label: 'Colaboradores', icon: 'users' },
  { id: 'propinas', label: 'Propinas', icon: 'tip' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AtlasAdmin() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [propinas, setPropinas] = useState<Propina[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hotelFilter, setHotelFilter] = useState('all')
  const [hotelModal, setHotelModal] = useState<Hotel | 'new' | null>(null)
  const [hotelDetalle, setHotelDetalle] = useState<string | null>(null)
  const [colModal, setColModal] = useState<Colaborador | 'new' | null>(null)
  const [usuarioModal, setUsuarioModal] = useState(false)
  const [expediente, setExpediente] = useState<Colaborador | null>(null)

  useEffect(() => { loadAll() }, [])

  // Drill-down: ver hotel en detalle
  if (hotelDetalle) {
    return <HotelDashboard hotelId={hotelDetalle} onBack={() => setHotelDetalle(null)} />
  }

  function exportarPropinas() {
    exportCSV(
      'propinas-atlas',
      ['Colaborador', 'Hotel', 'Monto', 'Estado', 'Fecha'],
      propinas.map(p => {
        const col = colaboradores.find(c => c.id === p.colaborador_id)
        const hot = hotels.find(h => h.id === p.hotel_id)
        return [col?.nombre ?? '—', hot?.nombre ?? '—', p.monto_total, p.estado, formatDateFull(p.created_at)]
      })
    )
  }

  function exportarColaboradores() {
    exportCSV(
      'colaboradores-atlas',
      ['Nombre', 'Puesto', 'Hotel', 'Link NFC', 'Estado'],
      colaboradores.map(c => {
        const hot = hotels.find(h => h.id === c.hotel_id)
        return [c.nombre, c.puesto ?? '—', hot?.nombre ?? '—', c.link_unico, c.activo ? 'Activo' : 'Inactivo']
      })
    )
  }

  async function loadAll() {
    setLoading(true)
    const [{ data: h }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('hotels').select('*').order('created_at', { ascending: false }),
      supabase.from('colaboradores').select('*').order('created_at', { ascending: false }),
      supabase.from('propinas').select('*').order('created_at', { ascending: false }),
    ])
    setHotels((h as Hotel[]) ?? [])
    setColaboradores((c as Colaborador[]) ?? [])
    setPropinas((p as Propina[]) ?? [])
    setLoading(false)
  }

  const totalPropinas = propinas.reduce((s, p) => s + p.monto_total, 0)
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const propinasMes = propinas.filter(p => new Date(p.created_at) >= inicioMes)
  const totalMes = propinasMes.reduce((s, p) => s + p.monto_total, 0)

  const filteredCols = colaboradores.filter(c => {
    const matchH = hotelFilter === 'all' || c.hotel_id === hotelFilter
    const matchS = !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || c.puesto?.toLowerCase().includes(search.toLowerCase())
    return matchH && matchS
  })

  const filteredProps = propinas.filter(p => hotelFilter === 'all' || p.hotel_id === hotelFilter)

  return (
    <AppLayout navItems={NAV} activeTab={tab} onTabChange={id => { setTab(id as Tab); setSearch(''); setHotelFilter('all') }} title="Administración" subtitle="Operación tak!">

      <PageContent>
        {loading ? <Spinner /> : (
          <>
            {/* ══ RESUMEN ══ */}
            {tab === 'resumen' && (
              <>
                <PageHeader title="Resumen general" subtitle="Toda la plataforma, en un vistazo" />
                <KpiRow>
                  <KpiCard featured label="Propinas este mes" value={formatMXN(totalMes)} sub={`${propinasMes.length} transacciones`} icon="tip" />
                  <KpiCard label="Total histórico" value={formatMXN(totalPropinas)} sub={`${propinas.length} pagos`} icon="trend" />
                  <KpiCard label="Hoteles activos" value={String(hotels.length)} icon="hotel" />
                  <KpiCard label="Colaboradores" value={String(colaboradores.filter(c => c.activo).length)} sub="activos" icon="users" />
                </KpiRow>

                <div className="tk-grid-2">
                  <section>
                    <SectionHeader title="Hoteles" subtitle="Toca un hotel para ver su panel" />
                    {hotels.length === 0 ? (
                      <EmptyState icon="hotel" title="Aún no hay hoteles" text="Registra el primer hotel desde la sección Hoteles." />
                    ) : (
                      <Table headers={['Hotel', 'Colaboradores', 'Total']} numCols={[1, 2]}>
                        {hotels.slice(0, 6).map(h => {
                          const cols = colaboradores.filter(c => c.hotel_id === h.id).length
                          const total = propinas.filter(p => p.hotel_id === h.id).reduce((s, p) => s + p.monto_total, 0)
                          return (
                            <Tr key={h.id} onClick={() => setHotelDetalle(h.id)} label={`Ver panel de ${h.nombre}`}>
                              <Td bold>
                                <span className="tk-cell-person"><Avatar name={h.nombre} size={32} /><span>{h.nombre}</span></span>
                              </Td>
                              <Td right muted>{cols}</Td>
                              <Td right bold>{formatMXN(total)}</Td>
                            </Tr>
                          )
                        })}
                      </Table>
                    )}
                  </section>

                  {/* Actividad reciente */}
                  <section>
                    <SectionHeader title="Actividad reciente" subtitle="Últimas propinas registradas" />
                    {propinas.length === 0 ? (
                      <EmptyState icon="tip" title="Sin propinas todavía" text="Las propinas aparecerán aquí en cuanto se registren." />
                    ) : (
                      <Table headers={['Colaborador', 'Hotel', 'Monto', 'Estado']} numCols={[2]}>
                        {propinas.slice(0, 8).map(p => {
                          const col = colaboradores.find(c => c.id === p.colaborador_id)
                          const hot = hotels.find(h => h.id === p.hotel_id)
                          return (
                            <Tr key={p.id}>
                              <Td bold>{col?.nombre ?? '—'}</Td>
                              <Td muted>{hot?.nombre ?? '—'}</Td>
                              <Td right bold>{formatMXN(p.monto_total)}</Td>
                              <Td><StatusBadge estado={p.estado} /></Td>
                            </Tr>
                          )
                        })}
                      </Table>
                    )}
                  </section>
                </div>
              </>
            )}

            {/* ══ HOTELES ══ */}
            {tab === 'hoteles' && (
              <>
                <PageHeader
                  title="Hoteles"
                  subtitle={`${hotels.length} hoteles registrados`}
                  action={<Btn icon="plus" onClick={() => setHotelModal('new')}>Nuevo hotel</Btn>}
                />
                {hotels.length === 0 ? (
                  <EmptyState icon="hotel" title="Aún no hay hoteles registrados" text="Crea el primer hotel para empezar a sumar colaboradores." action={<Btn icon="plus" onClick={() => setHotelModal('new')}>Nuevo hotel</Btn>} />
                ) : (
                  <Table headers={['Hotel', 'Colaboradores', 'Propinas', 'Total generado', 'Stripe', 'Desde', '']} numCols={[1, 2, 3]}>
                    {hotels.map(h => {
                      const cols = colaboradores.filter(c => c.hotel_id === h.id)
                      const props = propinas.filter(p => p.hotel_id === h.id)
                      const total = props.reduce((s, p) => s + p.monto_total, 0)
                      return (
                        <Tr key={h.id}>
                          <Td bold>
                            <span className="tk-cell-person"><Avatar name={h.nombre} size={36} /><span>{h.nombre}</span></span>
                          </Td>
                          <Td right muted>{cols.length}</Td>
                          <Td right muted>{props.length}</Td>
                          <Td right bold>{formatMXN(total)}</Td>
                          <Td>
                            <Badge text={h.stripe_api_key ? 'Conectado' : 'Sin conectar'} tone={h.stripe_api_key ? 'success' : 'warning'} />
                          </Td>
                          <Td muted nowrap>{formatDate(h.created_at)}</Td>
                          <Td>
                            <div className="tk-row-actions">
                              <Btn small variant="secondary" onClick={() => setHotelDetalle(h.id)}>Ver panel</Btn>
                              <IconBtn small icon="edit" label={`Editar ${h.nombre}`} onClick={() => setHotelModal(h)} />
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Table>
                )}
              </>
            )}

            {/* ══ COLABORADORES ══ */}
            {tab === 'colaboradores' && (
              <>
                <PageHeader
                  title="Colaboradores"
                  subtitle={`${colaboradores.length} colaboradores en la plataforma`}
                  action={
                    <>
                      <Btn variant="secondary" icon="download" onClick={exportarColaboradores}>Exportar CSV</Btn>
                      <Btn variant="secondary" icon="key" onClick={() => setUsuarioModal(true)}>Crear acceso</Btn>
                      <Btn icon="plus" onClick={() => setColModal('new')}>Nuevo colaborador</Btn>
                    </>
                  }
                />
                {/* Filtros */}
                <div className="tk-toolbar" role="search">
                  <span className="tk-input-wrap tk-input-wrap--icon">
                    <Icon name="search" className="tk-input-wrap__icon" />
                    <input
                      className="tk-input"
                      aria-label="Buscar colaborador"
                      placeholder="Buscar por nombre o puesto"
                      value={search} onChange={e => setSearch(e.target.value)}
                    />
                  </span>
                  <select className="tk-select" aria-label="Filtrar por hotel" value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}>
                    <option value="all">Todos los hoteles</option>
                    {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                  </select>
                </div>
                {filteredCols.length === 0 ? (
                  <EmptyState icon="users" title="No se encontraron colaboradores" text={search || hotelFilter !== 'all' ? 'Prueba con otro nombre o cambia el filtro de hotel.' : 'Agrega el primer colaborador para generar su enlace NFC.'} />
                ) : (
                  <Table headers={['Colaborador', 'Puesto', 'Hotel', 'Enlace NFC', 'Propinas', 'Total', 'Estado', '']} numCols={[4, 5]}>
                    {filteredCols.map(c => {
                      const hotel = hotels.find(h => h.id === c.hotel_id)
                      const props = propinas.filter(p => p.colaborador_id === c.id)
                      const total = props.reduce((s, p) => s + p.monto_total, 0)
                      return (
                        <Tr key={c.id}>
                          <Td bold>
                            <span className="tk-cell-person"><ColaboradorAvatar col={c} size={36} /><span>{c.nombre}</span></span>
                          </Td>
                          <Td muted>{c.puesto ?? '—'}</Td>
                          <Td muted>{hotel?.nombre ?? '—'}</Td>
                          <Td>
                            <CopyLink linkUnico={c.link_unico} />
                          </Td>
                          <Td right muted>{props.length}</Td>
                          <Td right bold>{formatMXN(total)}</Td>
                          <Td><ActiveBadge activo={c.activo} /></Td>
                          <Td>
                            <div className="tk-row-actions">
                              <Btn small variant="secondary" onClick={() => setExpediente(c)}>Expediente</Btn>
                              <IconBtn small icon="edit" label={`Editar ${c.nombre}`} onClick={() => setColModal(c)} />
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Table>
                )}
              </>
            )}

            {/* ══ PROPINAS ══ */}
            {tab === 'propinas' && (
              <>
                <PageHeader title="Propinas" subtitle="Historial completo de transacciones" action={<Btn variant="secondary" icon="download" onClick={exportarPropinas}>Exportar CSV</Btn>} />
                <div className="tk-toolbar">
                  <select className="tk-select" aria-label="Filtrar por hotel" value={hotelFilter} onChange={e => setHotelFilter(e.target.value)}>
                    <option value="all">Todos los hoteles</option>
                    {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
                  </select>
                </div>
                <KpiRow>
                  <KpiCard label="Total filtrado" value={formatMXN(filteredProps.reduce((s, p) => s + p.monto_total, 0))} icon="coins" />
                  <KpiCard label="Transacciones" value={String(filteredProps.length)} icon="history" />
                  <KpiCard label="Promedio" value={filteredProps.length ? formatMXN(filteredProps.reduce((s, p) => s + p.monto_total, 0) / filteredProps.length) : '—'} icon="chart" />
                </KpiRow>
                {filteredProps.length === 0 ? (
                  <EmptyState icon="tip" title="No hay propinas registradas" text="Cuando un huésped deje una propina aparecerá aquí." />
                ) : (
                  <Table headers={['Colaborador', 'Hotel', 'Monto', 'Estado', 'Fecha']} numCols={[2]}>
                    {filteredProps.slice(0, 100).map(p => {
                      const col = colaboradores.find(c => c.id === p.colaborador_id)
                      const hot = hotels.find(h => h.id === p.hotel_id)
                      return (
                        <Tr key={p.id}>
                          <Td bold>{col?.nombre ?? '—'}</Td>
                          <Td muted>{hot?.nombre ?? '—'}</Td>
                          <Td right bold>{formatMXN(p.monto_total)}</Td>
                          <Td><StatusBadge estado={p.estado} /></Td>
                          <Td muted nowrap>{timeAgo(p.created_at)}</Td>
                        </Tr>
                      )
                    })}
                  </Table>
                )}
              </>
            )}
          </>
        )}
      </PageContent>

      {/* ── Modals ── */}
      {hotelModal !== null && (
        <HotelModal
          hotel={hotelModal === 'new' ? null : hotelModal}
          onClose={() => setHotelModal(null)}
          onSave={() => { setHotelModal(null); loadAll() }}
        />
      )}
      {colModal !== null && (
        <ColaboradorModal
          colaborador={colModal === 'new' ? null : colModal}
          hotels={hotels}
          onClose={() => setColModal(null)}
          onSave={() => { setColModal(null); loadAll() }}
        />
      )}
      {usuarioModal && (
        <CrearUsuarioModal
          hotels={hotels}
          colaboradores={colaboradores}
          onClose={() => setUsuarioModal(false)}
          onSave={() => { setUsuarioModal(false); loadAll() }}
        />
      )}

      {expediente && <ExpedienteModal colaborador={expediente as ColaboradorCompleto} onClose={() => setExpediente(null)} onSave={() => { setExpediente(null); loadAll() }} />}
    </AppLayout>
  )
}

// ─── Hotel Modal ──────────────────────────────────────────────────────────────

function HotelModal({ hotel, onClose, onSave }: { hotel: Hotel | null; onClose: () => void; onSave: () => void }) {
  const [nombre, setNombre] = useState(hotel?.nombre ?? '')
  const [stripe, setStripe] = useState(hotel?.stripe_api_key ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    try {
      if (hotel) {
        await supabase.from('hotels').update({ nombre: nombre.trim(), stripe_api_key: stripe.trim() || null }).eq('id', hotel.id)
      } else {
        await supabase.from('hotels').insert({ nombre: nombre.trim(), stripe_api_key: stripe.trim() || null })
      }
      onSave()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={hotel ? 'Editar hotel' : 'Nuevo hotel'} onClose={onClose}>
      <FormField label="Nombre del hotel">
        <Input value={nombre} onChange={setNombre} placeholder="Ej. Hotel Camino Real" />
      </FormField>
      <FormField label="Clave API de Stripe" hint="Opcional. Necesaria para procesar pagos reales.">
        <Input value={stripe} onChange={setStripe} placeholder="sk_live_..." />
      </FormField>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── Colaborador Modal ────────────────────────────────────────────────────────

function ColaboradorModal({ colaborador, hotels, onClose, onSave }: { colaborador: Colaborador | null; hotels: Hotel[]; onClose: () => void; onSave: () => void }) {
  const [nombre, setNombre] = useState(colaborador?.nombre ?? '')
  const [puesto, setPuesto] = useState(colaborador?.puesto ?? '')
  const [hotelId, setHotelId] = useState(colaborador?.hotel_id ?? hotels[0]?.id ?? '')
  const [link, setLink] = useState(colaborador?.link_unico ?? '')
  const [activo, setActivo] = useState(colaborador?.activo ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSave() {
    if (!nombre.trim() || !link.trim() || !hotelId) { setError('Completa todos los campos requeridos'); return }
    setSaving(true)
    try {
      if (colaborador) {
        await supabase.from('colaboradores').update({ nombre: nombre.trim(), puesto: puesto.trim() || null, hotel_id: hotelId, link_unico: link.trim(), activo }).eq('id', colaborador.id)
      } else {
        await supabase.from('colaboradores').insert({ nombre: nombre.trim(), puesto: puesto.trim() || null, hotel_id: hotelId, link_unico: link.trim(), activo: true })
      }
      onSave()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={colaborador ? 'Editar colaborador' : 'Nuevo colaborador'} onClose={onClose}>
      <FormField label="Nombre completo">
        <Input value={nombre} onChange={v => { setNombre(v); if (!colaborador) setLink(slugify(v)) }} placeholder="Jorge Martínez" />
      </FormField>
      <FormField label="Puesto">
        <Input value={puesto} onChange={setPuesto} placeholder="Botones, Spa, Recepción..." />
      </FormField>
      <FormField label="Hotel">
        <Select value={hotelId} onChange={setHotelId}>
          {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
        </Select>
      </FormField>
      <FormField label="Enlace único NFC" hint={`Dirección de propina: ${TIP_BASE_URL}/${link || '…'}`}>
        <Input value={link} onChange={setLink} placeholder="jorge-martinez" />
      </FormField>
      {colaborador && (
        <FormField label="Estado">
          <Select value={activo ? 'activo' : 'inactivo'} onChange={v => setActivo(v === 'activo')}>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </Select>
        </FormField>
      )}
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── Crear Usuario Modal ──────────────────────────────────────────────────────

function CrearUsuarioModal({ hotels, colaboradores, onClose, onSave }: {
  hotels: Hotel[]
  colaboradores: Colaborador[]
  onClose: () => void
  onSave: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<'hotel_admin' | 'colaborador' | 'atlas_admin'>('hotel_admin')
  const [hotelId, setHotelId] = useState(hotels[0]?.id ?? '')
  const [colaboradorId, setColaboradorId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const colsDelHotel = colaboradores.filter(c => c.hotel_id === hotelId)

  async function handleSave() {
    if (!email.trim() || !password.trim()) { setError('Email y contraseña son requeridos'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if ((rol === 'hotel_admin' || rol === 'colaborador') && !hotelId) { setError('Selecciona un hotel'); return }
    if (rol === 'colaborador' && !colaboradorId) { setError('Selecciona el colaborador asociado'); return }

    setSaving(true)
    setError('')
    const err = await crearUsuario({
      email: email.trim(),
      password,
      rol,
      hotel_id: rol !== 'atlas_admin' ? hotelId : null,
      colaborador_id: rol === 'colaborador' ? colaboradorId : null,
    })
    if (err) { setError(err); setSaving(false); return }
    onSave()
  }

  return (
    <Modal title="Crear acceso" onClose={onClose}>
      <FormField label="Rol">
        <Select value={rol} onChange={v => setRol(v as any)}>
          <option value="hotel_admin">Gerente de hotel</option>
          <option value="colaborador">Colaborador</option>
          <option value="atlas_admin">Admin de tak!</option>
        </Select>
      </FormField>

      {rol !== 'atlas_admin' && (
        <FormField label="Hotel">
          <Select value={hotelId} onChange={v => { setHotelId(v); setColaboradorId('') }}>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </Select>
        </FormField>
      )}

      {rol === 'colaborador' && (
        <FormField label="Colaborador" hint="El perfil de colaborador que usará este acceso">
          <Select value={colaboradorId} onChange={setColaboradorId}>
            <option value="">Selecciona un colaborador</option>
            {colsDelHotel.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.puesto ?? 'Sin puesto'}</option>)}
          </Select>
        </FormField>
      )}

      <FormField label="Correo electrónico">
        <Input value={email} onChange={setEmail} placeholder="correo@ejemplo.com" type="email" inputMode="email" autoComplete="off" />
      </FormField>

      <FormField label="Contraseña" hint="Mínimo 6 caracteres">
        <Input value={password} onChange={setPassword} placeholder="••••••••" type="password" autoComplete="new-password" />
      </FormField>

      {error && <Alert>{error}</Alert>}

      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>
          {saving ? 'Creando…' : 'Crear acceso'}
        </Btn>
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
