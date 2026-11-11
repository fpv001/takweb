import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { limpiarPlaceId } from '@/lib/googlePlace'
import {
  PageHeader, Table, Tr, Td, ActiveBadge, Btn, IconBtn, Modal, ModalActions, FormField, Input, Alert, EmptyState,
} from '@/components/UI'

export type Sucursal = {
  id: string; hotel_id: string; nombre: string; direccion: string | null
  google_place_id: string | null; activo: boolean; created_at: string
}

export type SucursalStats = { docks: number; resenas: number; promedio: number }

type Props = {
  hotelId: string
  sucursales: Sucursal[]
  stats: Record<string, SucursalStats>
  onChange: () => void
  onVerDocks: (sucursalId: string) => void
}

// Lista de sucursales con su resumen. Se usa en el dashboard del gerente y en el panel admin.
export function SucursalesPanel({ hotelId, sucursales, stats, onChange, onVerDocks }: Props) {
  const [modal, setModal] = useState<Sucursal | 'new' | null>(null)
  const [toast, setToast] = useState('')

  async function toggle(s: Sucursal) {
    const { error } = await supabase.from('sucursales').update({ activo: !s.activo }).eq('id', s.id)
    if (error) { setToast('No se pudo cambiar el estado: ' + error.message); return }
    onChange()
  }

  return (
    <>
      <PageHeader
        title="Sucursales"
        subtitle="Cada sucursal tiene sus propios docks y su propia ubicación en Google."
        action={<Btn icon="plus" onClick={() => setModal('new')}>Nueva sucursal</Btn>}
      />
      {toast && <Alert>{toast}</Alert>}
      {sucursales.length === 0 ? (
        <EmptyState
          icon="hotel"
          title="Aún no tienes sucursales"
          text="Crea la primera sucursal para empezar a agregar docks."
          action={<Btn icon="plus" onClick={() => setModal('new')}>Nueva sucursal</Btn>}
        />
      ) : (
        <Table headers={['Sucursal', 'Dirección', 'Docks', 'Reseñas', 'Promedio', 'Estado', '']} numCols={[2, 3, 4]}>
          {sucursales.map(s => {
            const st = stats[s.id] ?? { docks: 0, resenas: 0, promedio: 0 }
            return (
              <Tr key={s.id}>
                <Td bold>{s.nombre}</Td>
                <Td muted>{s.direccion || '—'}</Td>
                <Td right>{st.docks}</Td>
                <Td right muted>{st.resenas}</Td>
                <Td right bold>{st.promedio > 0 ? st.promedio.toFixed(1) : '—'}</Td>
                <Td><ActiveBadge activo={s.activo} /></Td>
                <Td>
                  <div className="tk-row-actions">
                    <Btn small variant="secondary" onClick={() => onVerDocks(s.id)}>Ver docks</Btn>
                    <Btn small variant="secondary" onClick={() => toggle(s)}>{s.activo ? 'Desactivar' : 'Activar'}</Btn>
                    <IconBtn small icon="edit" label={`Editar ${s.nombre}`} onClick={() => setModal(s)} />
                  </div>
                </Td>
              </Tr>
            )
          })}
        </Table>
      )}
      {modal !== null && (
        <SucursalModal
          hotelId={hotelId}
          sucursal={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); onChange() }}
        />
      )}
    </>
  )
}

function SucursalModal({ hotelId, sucursal, onClose, onSave }: {
  hotelId: string; sucursal: Sucursal | null; onClose: () => void; onSave: () => void
}) {
  const [nombre, setNombre] = useState(sucursal?.nombre ?? '')
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '')
  const [placeId, setPlaceId] = useState(sucursal?.google_place_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = limpiarPlaceId(placeId)

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (preview.error) { setError(preview.error); return }
    setSaving(true); setError('')
    try {
      const datos = {
        nombre: nombre.trim(),
        direccion: direccion.trim() || null,
        google_place_id: preview.valor || null,
      }
      const res = sucursal
        ? await supabase.from('sucursales').update(datos).eq('id', sucursal.id)
        : await supabase.from('sucursales').insert({ ...datos, hotel_id: hotelId, activo: true })
      if (res.error) { setError(res.error.message); return }
      onSave()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={sucursal ? 'Editar sucursal' : 'Nueva sucursal'} onClose={onClose}>
      <FormField label="Nombre de la sucursal" hint="Ej. Centro, Polanco, Sucursal Norte">
        <Input value={nombre} onChange={setNombre} placeholder="Centro" />
      </FormField>
      <FormField label="Dirección" hint="Opcional">
        <Input value={direccion} onChange={setDireccion} placeholder="Av. Juárez 123, Col. Centro" />
      </FormField>
      <FormField label="Google Place ID" hint="Opcional. Pega el Place ID (ChIJ…) o el enlace de Google de esta sucursal.">
        <Input value={placeId} onChange={setPlaceId} placeholder="ChIJ…" />
        {preview.error && <p className="tk-muted" style={{ marginTop: 6 }}>{preview.error}</p>}
        {!preview.error && preview.advertencia && <p className="tk-muted" style={{ marginTop: 6 }}>{preview.advertencia}</p>}
      </FormField>
      {error && <Alert>{error}</Alert>}
      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : 'Guardar'}</Btn>
      </ModalActions>
    </Modal>
  )
}
