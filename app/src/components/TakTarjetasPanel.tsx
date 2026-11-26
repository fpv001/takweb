import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { TAK_BASE_URL, sufijoAleatorio } from '@/lib/slug'
import { copiarTexto, googleReviewUrl, limpiarPlaceId } from '@/lib/googlePlace'
import { listarAccesos, type Acceso } from '@/lib/edgeFunctions'
import { exportCSV, formatDateFull } from '@/lib/export'
import { subirFotoTarjeta } from '@/lib/fotos'
import { FotoPicker } from '@/components/FotoPicker'
import {
  PageHeader, SectionHeader, Card, KpiRow, KpiCard, Table, Tr, Td, Badge, ActiveBadge, Btn, IconBtn,
  Modal, ModalActions, FormField, Input, Select, Alert, EmptyState, Spinner, Avatar, Stars,
} from '@/components/UI'

// Pestaña "Mi tak!": pulseras NFC de los admins de tak! (/k/<codigo>, linktree "Conoce tak!").
// El código de cada pulsera es permanente (va grabado en el chip); el dueño, nombre y foto se
// pueden cambiar aquí sin volver a grabarla. La configuración aplica a todas las pulseras.
// tak! es un negocio más: sus reseñas viven en resenas (hotel_id del negocio tak!) y se ven
// también en Negocios -> tak! -> Reseñas. tak_resenas solo dice qué pulsera trajo cada una.

type Tarjeta = { id: string; codigo: string; perfil_id: string | null; nombre_publico: string; foto_url: string | null; activo: boolean; created_at: string }
type StatsFila = { tarjeta_id: string; abrir: number; conoce: number; resena: number; video: number; google: number; resenas: number; promedio: number | null }
type Resena = { id: string; tarjeta_id: string | null; estrellas: number | null; comentario: string | null; publica: boolean; created_at: string }
type Config = { hotel_id: string | null; google_place_id: string | null; video_url: string | null; conoce_url: string }

const STATS_VACIAS: Omit<StatsFila, 'tarjeta_id'> = { abrir: 0, conoce: 0, resena: 0, video: 0, google: 0, resenas: 0, promedio: null }

const ligaDe = (codigo: string) => `${TAK_BASE_URL}/${codigo}`

function urlValida(v: string) {
  if (!v) return true
  if (v.startsWith('/') && !v.startsWith('//')) return true
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false }
}

export function TakTarjetasPanel({ onAbrirNegocio }: { onAbrirNegocio?: (hotelId: string) => void }) {
  const { user } = useAuth()
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [stats, setStats] = useState<Record<string, StatsFila>>({})
  const [resenas, setResenas] = useState<Resena[]>([])
  const [config, setConfig] = useState<Config>({ hotel_id: null, google_place_id: null, video_url: null, conoce_url: '/' })
  const [admins, setAdmins] = useState<Acceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [modal, setModal] = useState<Tarjeta | 'new' | null>(null)
  const [configModal, setConfigModal] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [t, s, tr, c, a] = await Promise.all([
      supabase.from('tak_tarjetas').select('*').order('created_at', { ascending: true }),
      supabase.from('tak_tarjetas_stats').select('*'),
      supabase.from('tak_resenas').select('resena_id, tarjeta_id'),
      supabase.from('tak_config').select('hotel_id, video_url, conoce_url, hotels(google_place_id)').maybeSingle(),
      listarAccesos(),
    ])
    // Reseñas del negocio tak! (todas, vengan o no de una pulsera), como en cualquier negocio
    const cfg = c.data as (Omit<Config, 'google_place_id'> & { hotels: { google_place_id: string | null } | null }) | null
    const hotelId = cfg?.hotel_id ?? null
    const pulseraDe = new Map(((tr.data as { resena_id: string; tarjeta_id: string }[]) ?? []).map(x => [x.resena_id, x.tarjeta_id]))
    const r = hotelId
      ? await supabase.from('resenas').select('id, estrellas, comentario, publica, created_at').eq('hotel_id', hotelId).order('created_at', { ascending: false }).limit(1000)
      : { data: [], error: null }
    const err = t.error || s.error || tr.error || c.error || r.error
    if (err) {
      console.error('Error cargando pulseras tak!:', err)
      setErrorCarga('No se pudieron cargar las pulseras. ¿Ya se ejecutó la migración 2026-11-24_tak_tarjetas.sql en Supabase?')
    }
    setTarjetas((t.data as Tarjeta[]) ?? [])
    setStats(Object.fromEntries(((s.data as StatsFila[]) ?? []).map(x => [x.tarjeta_id, x])))
    setResenas(((r.data as Omit<Resena, 'tarjeta_id'>[]) ?? []).map(x => ({ ...x, tarjeta_id: pulseraDe.get(x.id) ?? null })))
    if (cfg) setConfig({ hotel_id: cfg.hotel_id, video_url: cfg.video_url, conoce_url: cfg.conoce_url, google_place_id: cfg.hotels?.google_place_id ?? null })
    setAdmins(a.accesos.filter(x => x.rol === 'atlas_admin'))
    setCargando(false)
  }

  function copiar(codigo: string) {
    copiarTexto(ligaDe(codigo))
    setAviso(`Liga copiada: ${ligaDe(codigo)}`)
  }

  const st = (id: string) => stats[id] ?? { tarjeta_id: id, ...STATS_VACIAS }
  const emailDe = (perfilId: string | null) => admins.find(a => a.id === perfilId)?.email ?? null
  const nombreTarjeta = (id: string | null) => id ? tarjetas.find(x => x.id === id)?.nombre_publico ?? '—' : 'Directa'

  const mias = tarjetas.filter(x => x.perfil_id && x.perfil_id === user?.id)
  const ranking = [...tarjetas].sort((a, b) => (st(b.id).abrir + st(b.id).resenas) - (st(a.id).abrir + st(a.id).resenas))
  const total = tarjetas.reduce((acc, x) => {
    const s = st(x.id)
    return { abrir: acc.abrir + Number(s.abrir), conoce: acc.conoce + Number(s.conoce), video: acc.video + Number(s.video) }
  }, { abrir: 0, conoce: 0, video: 0 })
  const conEstrellas = resenas.filter(r => r.estrellas)
  const promedio = conEstrellas.length ? (conEstrellas.reduce((a, r) => a + (r.estrellas ?? 0), 0) / conEstrellas.length).toFixed(1) : '—'

  function exportarResenas() {
    exportCSV('resenas-tak', ['Pulsera', 'Estrellas', 'Comentario', 'Pasó a Google', 'Fecha'],
      resenas.map(r => [nombreTarjeta(r.tarjeta_id), r.estrellas ?? "", r.comentario ?? '', r.publica ? 'Sí' : 'No', formatDateFull(r.created_at)]))
  }

  if (cargando) return <Spinner />

  return (
    <>
      <PageHeader
        title="Mi tak!"
        subtitle="Pulseras NFC de tak!: cada admin tiene su liga para que conozcan tak!, nos dejen reseña y vean el video"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {config.hotel_id && onAbrirNegocio && (
              <Btn variant="secondary" icon="star" onClick={() => onAbrirNegocio(config.hotel_id!)}>Ver reseñas como negocio</Btn>
            )}
            <Btn variant="secondary" icon="settings" onClick={() => setConfigModal(true)}>Configuración</Btn>
            <Btn icon="plus" onClick={() => setModal('new')}>Nueva pulsera</Btn>
          </div>
        }
      />
      {errorCarga && <Alert>{errorCarga}</Alert>}
      {aviso && <Alert tone="success">{aviso}</Alert>}
      {!config.hotel_id && !errorCarga && (
        <Alert tone="warning">No hay negocio “tak!” ligado a las pulseras. Vuelve a ejecutar la migración 2026-11-24_tak_tarjetas.sql.</Alert>
      )}
      {config.hotel_id && !config.google_place_id && (
        <Alert tone="info">tak! aún no tiene Place ID de Google: las reseñas se guardan aquí y no se ofrece publicarlas en Google. Captúralo en Configuración cuando exista el perfil.</Alert>
      )}

      <KpiRow>
        <KpiCard label="Toques a pulseras" value={String(total.abrir)} icon="phone" featured />
        <KpiCard label="Reseñas a tak!" value={String(resenas.length)} sub={`Promedio ${promedio} ★`} icon="star" />
        <KpiCard label="Clics a Conoce tak!" value={String(total.conoce)} icon="heart" />
        <KpiCard label="Clics al video" value={String(total.video)} icon="play" />
      </KpiRow>

      <SectionHeader title="Mis pulseras" subtitle="Esta es la liga que se graba en tu chip NFC" />
      {mias.length === 0 ? (
        <EmptyState inline icon="key" title="Aún no tienes pulsera" text="Crea una con “Nueva pulsera” y asígnatela." />
      ) : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {mias.map(x => {
            const s = st(x.id)
            return (
              <Card key={x.id} title={x.nombre_publico} meta={<code style={{ wordBreak: 'break-all' }}>{ligaDe(x.codigo)}</code>}
                action={<ActiveBadge activo={x.activo} />}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Btn small icon="copy" onClick={() => copiar(x.codigo)}>Copiar liga</Btn>
                  <Btn small variant="secondary" icon="external" onClick={() => window.open(ligaDe(x.codigo), '_blank', 'noopener')}>Abrir</Btn>
                  <Btn small variant="secondary" icon="edit" onClick={() => setModal(x)}>Editar</Btn>
                </div>
                <p className="tk-muted">
                  {s.abrir} toques · {s.conoce} a Conoce tak! · {s.resenas} reseñas{s.promedio ? ` (${s.promedio} ★)` : ''} · {s.video} al video
                </p>
              </Card>
            )
          })}
        </div>
      )}

      <SectionHeader title="Equipo tak!" subtitle="Todas las pulseras, ordenadas por toques y reseñas" />
      <Table headers={['Pulsera', 'Dueño', 'Toques', 'Conoce', 'Reseñas', 'Google', 'Video', 'Estado', '']} numCols={[2, 3, 4, 5, 6]} empty={tarjetas.length === 0}>
        {ranking.map(x => {
          const s = st(x.id)
          return (
            <Tr key={x.id}>
              <Td bold><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar name={x.nombre_publico} src={x.foto_url} size={28} />{x.nombre_publico}</span></Td>
              <Td muted>{emailDe(x.perfil_id) ?? 'Sin asignar'}</Td>
              <Td right>{s.abrir}</Td>
              <Td right>{s.conoce}</Td>
              <Td right>{s.resenas}{s.promedio ? ` · ${s.promedio}★` : ''}</Td>
              <Td right>{s.google}</Td>
              <Td right>{s.video}</Td>
              <Td><ActiveBadge activo={x.activo} /></Td>
              <Td nowrap>
                <IconBtn icon="copy" label={`Copiar liga de ${x.nombre_publico}`} onClick={() => copiar(x.codigo)} small />
                <IconBtn icon="edit" label={`Editar ${x.nombre_publico}`} onClick={() => setModal(x)} small />
              </Td>
            </Tr>
          )
        })}
      </Table>

      <SectionHeader title="Reseñas a tak!" subtitle="Todas las reseñas del negocio tak!, con la pulsera que las trajo"
        action={resenas.length > 0 ? <Btn variant="secondary" icon="download" onClick={exportarResenas}>Exportar CSV</Btn> : undefined} />
      <Table headers={['Pulsera', 'Calificación', 'Comentario', 'Google', 'Fecha']} empty={resenas.length === 0}>
        {resenas.map(r => (
          <Tr key={r.id}>
            <Td bold>{nombreTarjeta(r.tarjeta_id)}</Td>
            <Td>{r.estrellas ? <Stars value={r.estrellas} /> : '—'}</Td>
            <Td wrap muted={!r.comentario}>{r.comentario ?? 'Sin comentario'}</Td>
            <Td>{r.publica ? <Badge text="Pasó a Google" tone="success" /> : <Badge text="Solo tak!" />}</Td>
            <Td nowrap muted>{formatDateFull(r.created_at)}</Td>
          </Tr>
        ))}
      </Table>

      {modal && (
        <TarjetaModal
          tarjeta={modal === 'new' ? null : modal}
          admins={admins}
          miId={user?.id ?? null}
          onClose={() => setModal(null)}
          onSaved={msg => { setModal(null); setAviso(msg); cargar() }}
        />
      )}
      {configModal && (
        <ConfigModal config={config} onClose={() => setConfigModal(false)}
          onSaved={() => { setConfigModal(false); setAviso('Configuración guardada: ya aplica a todas las pulseras.'); cargar() }} />
      )}
    </>
  )
}

// ─── Crear / editar pulsera ──────────────────────────────────────────────────

function TarjetaModal({ tarjeta, admins, miId, onClose, onSaved }: {
  tarjeta: Tarjeta | null; admins: Acceso[]; miId: string | null; onClose: () => void; onSaved: (msg: string) => void
}) {
  const [nombre, setNombre] = useState(tarjeta?.nombre_publico ?? '')
  const [perfilId, setPerfilId] = useState(tarjeta ? (tarjeta.perfil_id ?? '') : (miId ?? ''))
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoQuitada, setFotoQuitada] = useState(false)
  // Si el alta salió bien pero la foto falló, el siguiente "Guardar" ya no vuelve a crear
  const [creada, setCreada] = useState<{ id: string; codigo: string } | null>(null)
  const [activo, setActivo] = useState(tarjeta?.activo ?? true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function guardar() {
    const n = nombre.trim()
    if (!n) { setError('Escribe el nombre que verá la gente (ej. Esteban)'); return }
    if (n.length > 60) { setError('El nombre no puede pasar de 60 caracteres'); return }
    setSaving(true); setError('')
    const datos = { nombre_publico: n, perfil_id: perfilId || null, activo, ...(fotoQuitada && !fotoFile ? { foto_url: null } : {}) }

    let fila = tarjeta ? { id: tarjeta.id, codigo: tarjeta.codigo } : creada
    if (fila) {
      const { error: e } = await supabase.from('tak_tarjetas').update(datos).eq('id', fila.id)
      if (e) { setSaving(false); setError(e.message); return }
    } else {
      // Código nuevo de 8 caracteres; si choca (23505) se reintenta
      for (let i = 0; i < 4 && !fila; i++) {
        const codigo = sufijoAleatorio() + sufijoAleatorio()
        const { data, error: e } = await supabase.from('tak_tarjetas').insert({ ...datos, codigo }).select('id').single()
        if (!e && data) fila = { id: (data as { id: string }).id, codigo }
        else if (e && e.code !== '23505') { setSaving(false); setError(e.message); return }
      }
      if (!fila) { setSaving(false); setError('No se pudo generar un código único, intenta de nuevo'); return }
      setCreada(fila)
    }

    if (fotoFile) {
      try {
        const url = await subirFotoTarjeta(fila.id, fotoFile)
        const { error: e } = await supabase.from('tak_tarjetas').update({ foto_url: url }).eq('id', fila.id)
        if (e) throw e
      } catch (e: any) {
        setSaving(false)
        setError(`Los datos se guardaron, pero la foto no se subió: ${e.message}. Intenta de nuevo.`)
        return
      }
    }
    setSaving(false)
    onSaved(tarjeta ? 'Pulsera actualizada. La liga del chip sigue siendo la misma.' : `Pulsera creada. Graba esta liga en el chip: ${ligaDe(fila.codigo)}`)
  }

  return (
    <Modal title={tarjeta ? 'Editar pulsera' : 'Nueva pulsera tak!'} onClose={onClose}>
      {tarjeta && (
        <Alert tone="info">Liga del chip (no cambia): <code style={{ wordBreak: 'break-all' }}>{ligaDe(tarjeta.codigo)}</code></Alert>
      )}
      <FotoPicker nombre={nombre} value={tarjeta?.foto_url ?? null} file={fotoFile} quitada={fotoQuitada}
        onChange={(f, quitar) => { setFotoFile(f); setFotoQuitada(!!quitar) }} />
      <FormField label="Nombre visible" hint="Aparece como “Te lo presenta …”">
        <Input value={nombre} onChange={setNombre} placeholder="Esteban" />
      </FormField>
      <FormField label="Dueño (admin de tak!)" hint="Para reasignar una pulsera, solo cambia el dueño">
        <Select value={perfilId} onChange={setPerfilId}>
          <option value="">Sin asignar</option>
          {admins.map(a => <option key={a.id} value={a.id}>{a.email ?? a.id}{a.id === miId ? ' (tú)' : ''}</option>)}
        </Select>
      </FormField>
      <FormField label="Estado" hint="Si está inactiva, la pulsera muestra una página genérica de tak! sin tu nombre">
        <Select value={activo ? '1' : '0'} onChange={v => setActivo(v === '1')}>
          <option value="1">Activa</option>
          <option value="0">Inactiva (perdida o ya no se usa)</option>
        </Select>
      </FormField>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} loading={saving} disabled={saving}>{tarjeta ? 'Guardar' : 'Crear pulsera'}</Btn>
      </ModalActions>
    </Modal>
  )
}

// ─── Configuración global ────────────────────────────────────────────────────

function ConfigModal({ config, onClose, onSaved }: { config: Config; onClose: () => void; onSaved: () => void }) {
  const [placeId, setPlaceId] = useState(config.google_place_id ?? '')
  const [conoce, setConoce] = useState(config.conoce_url || '/')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const preview = limpiarPlaceId(placeId)

  async function guardar() {
    if (preview.error) { setError(preview.error); return }
    if (!conoce.trim() || !urlValida(conoce.trim())) { setError('La liga de “Conoce tak!” debe ser https://… o una ruta como /'); return }
    setSaving(true); setError('')
    if (config.hotel_id && preview.valor !== (config.google_place_id ?? '')) {
      // El Place ID es del negocio tak! (mismo RPC que usa Negocios)
      const { error: ep } = await supabase.rpc('set_hotel_google_place_id', { p_hotel_id: config.hotel_id, p_place_id: preview.valor })
      if (ep) { setSaving(false); setError('No se pudo guardar el Google Place ID: ' + ep.message); return }
    }
    const { error: e } = await supabase.from('tak_config').update({
      conoce_url: conoce.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved()
  }

  return (
    <Modal title="Configuración de las pulseras" onClose={onClose}>
      <FormField label="Place ID de Google de tak!" hint="Se guarda en el negocio tak! (igual que en Negocios). Vacío = las reseñas se quedan en tak!">
        <Input value={placeId} onChange={setPlaceId} placeholder="ChIJ..." />
      </FormField>
      <div style={{ marginTop: -8, marginBottom: 12 }}>
        <Btn small variant="secondary" icon="external" disabled={!preview.valor || !!preview.error}
          onClick={() => window.open(googleReviewUrl(preview.valor), '_blank', 'noopener')}>Probar enlace</Btn>
        {!preview.error && preview.advertencia && <p className="tk-muted" style={{ marginTop: 6 }}>{preview.advertencia}</p>}
      </div>
      <FormField label="Liga de “Conoce tak!”" hint="Por defecto la página principal (/)">
        <Input value={conoce} onChange={setConoce} placeholder="/" />
      </FormField>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={guardar} loading={saving} disabled={saving}>Guardar</Btn>
      </ModalActions>
    </Modal>
  )
}
