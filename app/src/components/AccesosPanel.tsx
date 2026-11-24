import { useEffect, useState } from 'react'
import {
  PageHeader, Table, Tr, Td, Badge, Btn, Modal, ModalActions, FormField, Input, Select, Alert, EmptyState, Skeleton,
} from '@/components/UI'
import {
  listarAccesos, crearUsuario, cambiarEstadoAcceso, restablecerPassword, passwordTemporal, ROL_LABEL,
  type Acceso, type RolAcceso,
} from '@/lib/edgeFunctions'

// Sección "Accesos": quién puede entrar al panel, con qué rol, y su estado.
// Los permisos reales los aplica la Edge Function crear-usuario y RLS en Supabase;
// aquí solo se ocultan los botones que el servidor rechazaría.
//   Admin de tak! -> crea y administra cualquier rol
//   Gerente       -> crea y administra colaboradores de su negocio; ve a los demás gerentes

type HotelMin = { id: string; nombre: string }
type ColMin = { id: string; nombre: string; puesto: string | null; hotel_id: string; activo: boolean }

type Props = {
  /** Rol de quien está usando el panel */
  miRol: RolAcceso
  /** Negocio fijo (panel del negocio). Sin él, vista global de tak! */
  hotelId?: string
  hotels: HotelMin[]
  colaboradores: ColMin[]
}

type Credenciales = { email: string; password: string; titulo: string }

function formatoFecha(iso: string | null) {
  if (!iso) return 'Nunca'
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function AccesosPanel({ miRol, hotelId, hotels, colaboradores }: Props) {
  const [accesos, setAccesos] = useState<Acceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [crear, setCrear] = useState(false)
  const [restablecer, setRestablecer] = useState<Acceso | null>(null)
  const [desactivar, setDesactivar] = useState<Acceso | null>(null)
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null)
  const [aviso, setAviso] = useState('')
  const [buscar, setBuscar] = useState('')
  const [filtroRol, setFiltroRol] = useState<'todos' | RolAcceso>('todos')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos')

  useEffect(() => { cargar() }, [hotelId])

  async function cargar() {
    setErrorCarga('')
    const r = await listarAccesos()
    if (r.error) setErrorCarga(r.error)
    // El admin de tak! recibe todos; dentro de un negocio se muestran solo los de ese negocio
    setAccesos(hotelId ? r.accesos.filter(a => a.hotel_id === hotelId) : r.accesos)
    setCargando(false)
  }

  async function reactivar(a: Acceso) {
    const err = await cambiarEstadoAcceso(a.id, true)
    setAviso(err ? `No se pudo reactivar: ${err}` : `${a.email} puede volver a entrar.`)
    if (!err) cargar()
  }

  const nombreHotel = (id: string | null) => hotels.find(h => h.id === id)?.nombre ?? '—'
  const nombreCol = (id: string | null) => colaboradores.find(c => c.id === id)?.nombre ?? null

  const q = buscar.trim().toLowerCase()
  const visibles = accesos
    .filter(a => filtroRol === 'todos' || a.rol === filtroRol)
    .filter(a => filtroEstado === 'todos' || (filtroEstado === 'activos' ? a.activo : !a.activo))
    .filter(a => !q || `${a.email ?? ''} ${nombreCol(a.colaborador_id) ?? ''} ${nombreHotel(a.hotel_id)}`.toLowerCase().includes(q))
    .sort((x, y) => Number(y.activo) - Number(x.activo) || (x.email ?? '').localeCompare(y.email ?? ''))

  const rolesVisibles: RolAcceso[] = hotelId ? ['hotel_admin', 'colaborador'] : ['atlas_admin', 'hotel_admin', 'colaborador']

  return (
    <>
      <PageHeader
        title="Accesos"
        subtitle={miRol === 'atlas_admin'
          ? 'Quién puede entrar al panel y con qué rol. Las cuentas se crean aquí; nadie se registra solo.'
          : 'Cuentas de tu equipo para entrar a su propio panel. Solo tak! puede crear gerentes.'}
        action={<Btn icon="key" onClick={() => { setAviso(''); setCrear(true) }}>Crear acceso</Btn>}
      />

      {aviso && <div style={{ marginBottom: 16 }}><Alert tone={aviso.startsWith('No se pudo') ? 'danger' : 'success'}>{aviso}</Alert></div>}
      {errorCarga && (
        <div style={{ marginBottom: 16 }}>
          <Alert>
            No se pudo cargar la lista: {errorCarga}. Si dice “Acción no válida”, falta desplegar la nueva versión de la función crear-usuario en Supabase.
          </Alert>
        </div>
      )}

      <div className="tk-toolbar" role="search">
        <input className="tk-input" type="search" placeholder="Buscar por correo o nombre" aria-label="Buscar accesos" value={buscar} onChange={e => setBuscar(e.target.value)} style={{ maxWidth: 280 }} />
        <select className="tk-select" aria-label="Filtrar por rol" value={filtroRol} onChange={e => setFiltroRol(e.target.value as typeof filtroRol)}>
          <option value="todos">Todos los roles</option>
          {rolesVisibles.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
        </select>
        <select className="tk-select" aria-label="Filtrar por estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}>
          <option value="todos">Activos e inactivos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </div>

      {cargando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true" aria-label="Cargando accesos">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} h={52} r={12} />)}
        </div>
      ) : visibles.length === 0 ? (
        <EmptyState icon="key" title={accesos.length ? 'Ningún acceso coincide con el filtro' : 'Aún no hay accesos'}
          text={accesos.length ? undefined : 'Crea el primero con el botón “Crear acceso”.'} />
      ) : (
        <Table headers={['Acceso', 'Rol', 'Último ingreso', 'Estado', '']}>
          {visibles.map(a => {
            // Debajo del correo: quién es y de qué negocio (el negocio solo en la vista global)
            const detalle = [nombreCol(a.colaborador_id), hotelId ? null : a.rol === 'atlas_admin' ? 'Todos los negocios' : nombreHotel(a.hotel_id)].filter(Boolean).join(' · ')
            return (
            <Tr key={a.id}>
              <Td wrap>
                <span style={{ display: 'block', fontWeight: 600, overflowWrap: 'anywhere' }}>{a.email ?? '—'}</span>
                {detalle && <span className="tk-muted" style={{ display: 'block', fontSize: 13 }}>{detalle}</span>}
              </Td>
              <Td nowrap><Badge text={ROL_LABEL[a.rol]} tone={a.rol === 'atlas_admin' ? 'warning' : a.rol === 'hotel_admin' ? 'success' : 'neutral'} /></Td>
              <Td muted nowrap>{formatoFecha(a.ultimo_ingreso)}</Td>
              <Td nowrap>
                {!a.activo ? <Badge text="Desactivado" tone="danger" />
                  : a.cambiar_password ? <Badge text="Contraseña temporal" tone="warning" />
                  : <Badge text="Activo" tone="success" />}
              </Td>
              <Td>
                {a.administrable && (
                  <div className="tk-row-actions" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {a.activo ? (
                      <>
                        <Btn small variant="secondary" onClick={() => { setAviso(''); setRestablecer(a) }}>Nueva contraseña</Btn>
                        <Btn small variant="secondary" onClick={() => { setAviso(''); setDesactivar(a) }}>Desactivar</Btn>
                      </>
                    ) : (
                      <Btn small variant="secondary" onClick={() => reactivar(a)}>Reactivar</Btn>
                    )}
                  </div>
                )}
              </Td>
            </Tr>
            )
          })}
        </Table>
      )}

      {crear && (
        <CrearAccesoModal
          miRol={miRol} hotelId={hotelId} hotels={hotels}
          colaboradores={colaboradores}
          colaboradoresConAcceso={new Set(accesos.map(a => a.colaborador_id).filter((x): x is string => !!x))}
          onClose={() => setCrear(false)}
          onCreado={c => { setCrear(false); setCredenciales(c); cargar() }}
        />
      )}
      {restablecer && (
        <RestablecerModal acceso={restablecer} onClose={() => setRestablecer(null)}
          onListo={c => { setRestablecer(null); setCredenciales(c); cargar() }} />
      )}
      {desactivar && (
        <DesactivarModal acceso={desactivar} onClose={() => setDesactivar(null)}
          onListo={() => { setAviso(`${desactivar.email} ya no puede entrar. Puedes reactivarlo cuando quieras.`); setDesactivar(null); cargar() }} />
      )}
      {credenciales && <CredencialesModal {...credenciales} onClose={() => setCredenciales(null)} />}
    </>
  )
}

// ─── Crear acceso ────────────────────────────────────────────────────────────

function CrearAccesoModal({ miRol, hotelId, hotels, colaboradores, colaboradoresConAcceso, onClose, onCreado }: {
  miRol: RolAcceso; hotelId?: string; hotels: HotelMin[]; colaboradores: ColMin[]
  colaboradoresConAcceso: Set<string>; onClose: () => void; onCreado: (c: Credenciales) => void
}) {
  // El gerente solo puede crear colaboradores; el admin de tak! cualquier rol
  const rolesPermitidos: RolAcceso[] = miRol === 'atlas_admin'
    ? (hotelId ? ['hotel_admin', 'colaborador'] : ['hotel_admin', 'colaborador', 'atlas_admin'])
    : ['colaborador']
  const [rol, setRol] = useState<RolAcceso>(rolesPermitidos[0])
  const [negocio, setNegocio] = useState(hotelId ?? hotels[0]?.id ?? '')
  const [colaboradorId, setColaboradorId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => passwordTemporal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const colsDelNegocio = colaboradores.filter(c => c.hotel_id === negocio && c.activo)

  const DESCRIPCION: Record<RolAcceso, string> = {
    atlas_admin: 'Ve y administra todos los negocios. Solo para el equipo de tak!.',
    hotel_admin: 'Administra su negocio: equipo, docks, reseñas y accesos de sus colaboradores.',
    colaborador: 'Ve solo su propio panel: sus propinas y reseñas.',
  }

  async function handleSave() {
    if (!email.trim()) { setError('Escribe el correo'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (rol !== 'atlas_admin' && !negocio) { setError('Selecciona un negocio'); return }
    if (rol === 'colaborador' && !colaboradorId) { setError('Selecciona el colaborador'); return }
    setSaving(true); setError('')
    const err = await crearUsuario({
      email: email.trim(), password, rol,
      hotel_id: rol !== 'atlas_admin' ? negocio : null,
      colaborador_id: rol === 'colaborador' ? colaboradorId : null,
    })
    setSaving(false)
    if (err) { setError(err); return }
    onCreado({ email: email.trim().toLowerCase(), password, titulo: 'Acceso creado' })
  }

  return (
    <Modal title="Crear acceso" onClose={onClose}>
      {rolesPermitidos.length > 1 && (
        <div className="tk-modes" role="radiogroup" aria-label="Rol">
          {rolesPermitidos.map(r => (
            <label key={r} className="tk-mode">
              <input type="radio" name="rol-acceso" checked={rol === r} onChange={() => { setRol(r); setError('') }} />
              <span>
                <span className="tk-mode__title">{ROL_LABEL[r]}</span>
                <span className="tk-mode__desc">{DESCRIPCION[r]}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      {rol !== 'atlas_admin' && !hotelId && (
        <FormField label="Negocio">
          <Select value={negocio} onChange={v => { setNegocio(v); setColaboradorId('') }}>
            {hotels.map(h => {
              // Si dos negocios se llaman igual, se distinguen por su número de colaboradores
              const repetido = hotels.filter(x => x.nombre === h.nombre).length > 1
              const n = colaboradores.filter(c => c.hotel_id === h.id).length
              return <option key={h.id} value={h.id}>{repetido ? `${h.nombre} (${n} colaboradores)` : h.nombre}</option>
            })}
          </Select>
        </FormField>
      )}

      {rol === 'colaborador' && (
        <FormField label="Colaborador" hint="La persona del equipo que usará este acceso. Cada colaborador tiene un solo acceso.">
          <Select value={colaboradorId} onChange={setColaboradorId}>
            <option value="">Selecciona un colaborador</option>
            {colsDelNegocio.map(c => (
              <option key={c.id} value={c.id} disabled={colaboradoresConAcceso.has(c.id)}>
                {c.nombre}{c.puesto ? ` — ${c.puesto}` : ''}{colaboradoresConAcceso.has(c.id) ? ' (ya tiene acceso)' : ''}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Correo electrónico" hint="Con este correo iniciará sesión">
        <Input value={email} onChange={setEmail} placeholder="correo@ejemplo.com" type="email" inputMode="email" autoComplete="off" />
      </FormField>

      <FormField label="Contraseña temporal" hint="Al entrar por primera vez se le pedirá elegir una nueva">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Input value={password} onChange={setPassword} autoComplete="new-password" /></div>
          <Btn variant="secondary" onClick={() => setPassword(passwordTemporal())}>Generar otra</Btn>
        </div>
      </FormField>

      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Creando…' : 'Crear acceso'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── Restablecer contraseña ──────────────────────────────────────────────────

function RestablecerModal({ acceso, onClose, onListo }: { acceso: Acceso; onClose: () => void; onListo: (c: Credenciales) => void }) {
  const [password, setPassword] = useState(() => passwordTemporal())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setSaving(true); setError('')
    const err = await restablecerPassword(acceso.id, password)
    setSaving(false)
    if (err) { setError(err); return }
    onListo({ email: acceso.email ?? '', password, titulo: 'Contraseña restablecida' })
  }

  return (
    <Modal title="Restablecer contraseña" onClose={onClose}>
      <p className="tk-muted" style={{ marginBottom: 16 }}>
        <strong>{acceso.email}</strong> entrará con esta contraseña temporal y el panel le pedirá elegir una nueva. La anterior deja de funcionar.
      </p>
      <FormField label="Contraseña temporal">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Input value={password} onChange={setPassword} autoComplete="new-password" /></div>
          <Btn variant="secondary" onClick={() => setPassword(passwordTemporal())}>Generar otra</Btn>
        </div>
      </FormField>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : 'Restablecer'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── Desactivar ──────────────────────────────────────────────────────────────

function DesactivarModal({ acceso, onClose, onListo }: { acceso: Acceso; onClose: () => void; onListo: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true); setError('')
    const err = await cambiarEstadoAcceso(acceso.id, false)
    setSaving(false)
    if (err) { setError(err); return }
    onListo()
  }

  return (
    <Modal title="Desactivar acceso" onClose={onClose}>
      <p style={{ marginBottom: 16 }}>
        <strong>{acceso.email}</strong> ya no podrá entrar al panel y perderá sus permisos de inmediato.
        Su historial (propinas, reseñas) no se borra, y puedes reactivarlo cuando quieras.
      </p>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="danger" onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Desactivando…' : 'Sí, desactivar'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── Credenciales para entregar ──────────────────────────────────────────────

function CredencialesModal({ email, password, titulo, onClose }: Credenciales & { onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)
  // Dirección pública del panel (aunque el acceso se cree desde una copia local)
  const url = `${import.meta.env.VITE_WEB_URL || 'https://www.thanksarekind.com'}/admin/`
  const texto = `Tu acceso a tak!\nEntra en: ${url}\nCorreo: ${email}\nContraseña temporal: ${password}\nAl entrar te pedirá elegir una contraseña nueva.`

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true) } catch { /* sin portapapeles */ }
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <Alert tone="success">Pásale estos datos a la persona. La contraseña no se vuelve a mostrar.</Alert>
      <pre style={{ margin: '16px 0', padding: 16, borderRadius: 12, background: 'var(--surface-sunken)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: 'inherit' }}>{texto}</pre>
      <ModalActions>
        <Btn variant="secondary" icon={copiado ? 'check' : 'copy'} onClick={copiar}>{copiado ? 'Copiado' : 'Copiar mensaje'}</Btn>
        <Btn onClick={onClose}>Listo</Btn>
      </ModalActions>
    </Modal>
  )
}
