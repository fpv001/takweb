import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  borrarFotoPlatillo, fotoPlatilloUrl, subirFotoPlatillo, type CalificacionPlatillo, type Platillo,
} from '@/lib/platillos'
import type { Sucursal } from '@/components/SucursalesPanel'
import {
  PageHeader, Table, Tr, Td, ActiveBadge, Btn, IconBtn, Modal, ModalActions, FormField, Input, Select, Alert,
  EmptyState, Card, Stars, Spinner, SectionHeader,
} from '@/components/UI'
import { Icon } from '@/components/Icon'

type Props = { hotelId: string; sucursales: Sucursal[] }

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

// Menú con foto que el cliente ve al tocar el dock, y lo que opina de cada platillo
export function PlatillosPanel({ hotelId, sucursales }: Props) {
  const [platillos, setPlatillos] = useState<Platillo[]>([])
  const [califs, setCalifs] = useState<CalificacionPlatillo[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Platillo | 'new' | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => { load() }, [hotelId])

  async function load() {
    const [{ data: pl, error: e1 }, { data: cs, error: e2 }] = await Promise.all([
      supabase.from('platillos').select('*').eq('hotel_id', hotelId).order('orden').order('nombre'),
      supabase.from('calificaciones_platillo').select('id, resena_id, platillo_id, estrellas, comentario, created_at')
        .eq('hotel_id', hotelId).order('created_at', { ascending: false }).limit(1000),
    ])
    if (e1 || e2) setAviso('No pudimos cargar los platillos. Recarga la página para intentar de nuevo.')
    setPlatillos((pl as Platillo[]) ?? [])
    setCalifs((cs as CalificacionPlatillo[]) ?? [])
    setLoading(false)
  }

  async function toggle(p: Platillo) {
    const { error } = await supabase.from('platillos').update({ activo: !p.activo }).eq('id', p.id)
    if (error) { setAviso('No se pudo cambiar el estado: ' + error.message); return }
    load()
  }

  const stats = new Map(platillos.map(p => {
    const cs = califs.filter(c => c.platillo_id === p.id)
    return [p.id, { n: cs.length, promedio: cs.length ? cs.reduce((s, c) => s + c.estrellas, 0) / cs.length : 0 }]
  }))
  const comentarios = califs.filter(c => c.comentario).slice(0, 20)
  const nombreSucursal = (id: string | null) => id ? sucursales.find(s => s.id === id)?.nombre ?? '—' : 'Todas'

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Platillos"
        subtitle="Tu menú con foto. Al tocar el dock, el cliente elige lo que comió y califica cada platillo."
        action={<Btn icon="plus" onClick={() => setModal('new')}>Nuevo platillo</Btn>}
      />
      {aviso && <Alert>{aviso}</Alert>}
      {platillos.length === 0 ? (
        <EmptyState
          icon="camera"
          title="Aún no tienes platillos"
          text="Agrega tus platillos con una foto. Aparecerán en la pantalla de reseña de todos tus docks."
          action={<Btn icon="plus" onClick={() => setModal('new')}>Nuevo platillo</Btn>}
        />
      ) : (
        <Table headers={['Platillo', 'Sucursal', 'Calificaciones', 'Promedio', 'Estado', '']} numCols={[2, 3]}>
          {platillos.map(p => {
            const st = stats.get(p.id) ?? { n: 0, promedio: 0 }
            const foto = fotoPlatilloUrl(p.foto_path)
            return (
              <Tr key={p.id}>
                <Td bold>
                  <span className="tk-dish-cell">
                    <span className="tk-dish-rate__thumb">{foto ? <img src={foto} alt="" loading="lazy" /> : <span aria-hidden="true">{p.nombre.charAt(0)}</span>}</span>
                    <span>{p.nombre}</span>
                  </span>
                </Td>
                <Td muted>{nombreSucursal(p.sucursal_id)}</Td>
                <Td right muted>{st.n}</Td>
                <Td right bold>{st.n ? st.promedio.toFixed(1) : '—'}</Td>
                <Td><ActiveBadge activo={p.activo} /></Td>
                <Td>
                  <div className="tk-row-actions">
                    <Btn small variant="secondary" onClick={() => toggle(p)}>{p.activo ? 'Ocultar' : 'Mostrar'}</Btn>
                    <IconBtn small icon="edit" label={`Editar ${p.nombre}`} onClick={() => setModal(p)} />
                  </div>
                </Td>
              </Tr>
            )
          })}
        </Table>
      )}

      {platillos.length > 0 && (
        <>
          <SectionHeader title="Comentarios recientes" subtitle="Lo que escriben tus clientes sobre cada platillo" />
          <Card>
            {comentarios.length === 0 ? (
              <EmptyState inline icon="message" title="Sin comentarios aún" text="Aparecerán aquí cuando un cliente comente un platillo." />
            ) : (
              <div className="tk-list">
                {comentarios.map(c => (
                  <div key={c.id} className="tk-list__item">
                    <div className="tk-list__main">
                      <p className="tk-list__name">{platillos.find(p => p.id === c.platillo_id)?.nombre ?? '—'}</p>
                      <p className="tk-list__meta" style={{ whiteSpace: 'normal' }}>{c.comentario}</p>
                    </div>
                    <div className="tk-list__end">
                      <Stars value={c.estrellas} />
                      <span className="tk-list__meta">{formatDate(c.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {modal !== null && (
        <PlatilloModal
          hotelId={hotelId}
          platillo={modal === 'new' ? null : modal}
          sucursales={sucursales}
          siguienteOrden={platillos.length}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </>
  )
}

function PlatilloModal({ hotelId, platillo, sucursales, siguienteOrden, onClose, onSave }: {
  hotelId: string; platillo: Platillo | null; sucursales: Sucursal[]; siguienteOrden: number; onClose: () => void; onSave: () => void
}) {
  const [nombre, setNombre] = useState(platillo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(platillo?.descripcion ?? '')
  const [sucursalId, setSucursalId] = useState(platillo?.sucursal_id ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(fotoPlatilloUrl(platillo?.foto_path ?? null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (archivo && preview) URL.revokeObjectURL(preview) }, [archivo, preview])

  function elegirFoto(f: File | undefined) {
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Elige una imagen (JPG, PNG o WebP).'); return }
    setError('')
    setArchivo(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre del platillo es requerido'); return }
    if (nombre.trim().length > 80) { setError('El nombre admite hasta 80 caracteres'); return }
    setSaving(true); setError('')
    let nuevaFoto: string | null = null
    try {
      if (archivo) nuevaFoto = await subirFotoPlatillo(hotelId, archivo)
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        sucursal_id: sucursalId || null,
        ...(nuevaFoto ? { foto_path: nuevaFoto } : {}),
      }
      const res = platillo
        ? await supabase.from('platillos').update(datos).eq('id', platillo.id)
        : await supabase.from('platillos').insert({ ...datos, hotel_id: hotelId, activo: true, orden: siguienteOrden })
      if (res.error) {
        if (nuevaFoto) await borrarFotoPlatillo(nuevaFoto)
        setError(res.error.message)
        return
      }
      if (nuevaFoto && platillo?.foto_path) await borrarFotoPlatillo(platillo.foto_path)
      onSave()
    } catch (e: any) {
      setError(e.message ?? 'No se pudo guardar el platillo')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={platillo ? 'Editar platillo' : 'Nuevo platillo'} onClose={onClose}>
      <FormField label="Foto" hint="Una foto clara del platillo. Se ajusta automáticamente para cargar rápido.">
        <button type="button" className="tk-dish-upload" onClick={() => inputRef.current?.click()}>
          {preview ? <img src={preview} alt="Vista previa del platillo" /> : (
            <span className="tk-dish-upload__empty"><Icon name="camera" /><span>Elegir foto</span></span>
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => elegirFoto(e.target.files?.[0])} />
        {preview && <Btn small variant="secondary" icon="camera" onClick={() => inputRef.current?.click()}>Cambiar foto</Btn>}
      </FormField>
      <FormField label="Nombre del platillo">
        <Input value={nombre} onChange={setNombre} placeholder="Tacos al pastor" />
      </FormField>
      <FormField label="Descripción" hint="Opcional. Aparece bajo el nombre en la pantalla del cliente.">
        <Input value={descripcion} onChange={setDescripcion} placeholder="Orden de 4 con piña" />
      </FormField>
      {sucursales.length > 1 && (
        <FormField label="Sucursal" hint="Elige dónde se ofrece este platillo">
          <Select value={sucursalId} onChange={setSucursalId}>
            <option value="">Todas las sucursales</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
