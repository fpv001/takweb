import { useState, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { getInitials } from '@/lib/utils'
import { Modal, ModalActions, FormField, Input, Select, Btn, Avatar, ActiveBadge, Alert } from '@/components/UI'
import { Icon } from '@/components/Icon'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ColaboradorCompleto = {
  id: string
  nombre: string
  puesto: string | null
  link_unico: string
  activo: boolean
  foto_url: string | null
  telefono: string | null
  fecha_ingreso: string | null
  notas: string | null
  hotel_id: string
  created_at: string
}

// ─── Avatar con foto ─────────────────────────────────────────────────────────

export function ColaboradorAvatar({ col, size = 40 }: { col: { nombre: string; foto_url: string | null }; size?: number }) {
  return <Avatar name={col.nombre} src={col.foto_url} size={size} />
}

// ─── Modal de expediente ─────────────────────────────────────────────────────

type Props = {
  colaborador: ColaboradorCompleto
  onClose: () => void
  onSave: (updated: ColaboradorCompleto) => void
  readOnly?: boolean
}

export function ExpedienteModal({ colaborador, onClose, onSave, readOnly = false }: Props) {
  const [nombre, setNombre] = useState(colaborador.nombre)
  const [puesto, setPuesto] = useState(colaborador.puesto ?? '')
  const [telefono, setTelefono] = useState(colaborador.telefono ?? '')
  const [fechaIngreso, setFechaIngreso] = useState(colaborador.fecha_ingreso ?? '')
  const [notas, setNotas] = useState(colaborador.notas ?? '')
  const [activo, setActivo] = useState(colaborador.activo)
  const [fotoUrl, setFotoUrl] = useState(colaborador.foto_url ?? '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Solo se permiten imágenes'); return }
    if (file.size > 2 * 1024 * 1024) { setError('La imagen debe ser menor a 2MB'); return }

    setUploadingFoto(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${colaborador.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('colaboradores')
      .upload(path, file, { upsert: true })

    if (uploadError) { setError('Error subiendo foto: ' + uploadError.message); setUploadingFoto(false); return }

    const { data } = supabase.storage.from('colaboradores').getPublicUrl(path)
    setFotoUrl(data.publicUrl + '?t=' + Date.now()) // cache bust
    setUploadingFoto(false)
  }

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')
    try {
      const updates = {
        nombre: nombre.trim(),
        puesto: puesto.trim() || null,
        telefono: telefono.trim() || null,
        fecha_ingreso: fechaIngreso || null,
        notas: notas.trim() || null,
        activo,
        foto_url: fotoUrl || null,
      }
      const { error } = await supabase.from('colaboradores').update(updates).eq('id', colaborador.id)
      if (error) throw error
      onSave({ ...colaborador, ...updates })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const ingresoLabel = fechaIngreso
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(fechaIngreso + 'T12:00:00'))
    : null

  return (
    <Modal title="Expediente" onClose={onClose} wide>

      {/* Foto + info básica */}
      <div className="tk-dossier">
        <div className="tk-dossier__photo">
          {uploadingFoto ? (
            <span className="tk-avatar" style={{ width: 88, height: 88 }} aria-busy="true"><span className="tk-btn__spin" style={{ color: 'var(--brand-700)', width: 24, height: 24 }} /></span>
          ) : (
            <Avatar name={nombre || colaborador.nombre} src={fotoUrl || null} size={88} />
          )}
          {!readOnly && (
            <>
              <button type="button" className="tk-dossier__cam" aria-label="Cambiar foto" title="Cambiar foto" onClick={() => fileRef.current?.click()}>
                <Icon name="camera" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
            </>
          )}
        </div>

        {/* Info rápida */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="tk-dossier__name">{nombre || colaborador.nombre}</p>
          <p className="tk-dossier__role">{puesto || 'Sin puesto asignado'}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActiveBadge activo={activo} />
            {ingresoLabel && <span className="tk-badge tk-badge--brand">Desde {ingresoLabel}</span>}
          </div>
        </div>
      </div>

      {readOnly ? (
        /* Vista solo lectura */
        <div>
          <dl className="tk-readonly">
            {telefono && (<><dt>Teléfono</dt><dd>{telefono}</dd></>)}
            {notas && (<><dt>Notas</dt><dd>{notas}</dd></>)}
          </dl>
          <ModalActions>
            <Btn variant="secondary" onClick={onClose}>Cerrar</Btn>
          </ModalActions>
        </div>
      ) : (
        /* Formulario editable */
        <>
          <div className="tk-form-grid">
            <FormField label="Nombre completo">
              <Input value={nombre} onChange={setNombre} placeholder="Jorge Martínez" />
            </FormField>
            <FormField label="Puesto">
              <Input value={puesto} onChange={setPuesto} placeholder="Botones, Spa…" />
            </FormField>
            <FormField label="Teléfono">
              <Input value={telefono} onChange={setTelefono} placeholder="+52 55 1234 5678" type="tel" inputMode="tel" />
            </FormField>
            <FormField label="Fecha de ingreso">
              <input className="tk-input" type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Estado">
            <Select value={activo ? 'activo' : 'inactivo'} onChange={v => setActivo(v === 'activo')}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </Select>
          </FormField>

          <FormField label="Notas internas" hint="Solo las ven el gerente y el equipo de tak!">
            <textarea
              className="tk-textarea"
              value={notas} onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones, habilidades especiales, turno preferido…"
            />
          </FormField>

          {error && <Alert>{error}</Alert>}

          <ModalActions>
            <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
            <Btn onClick={handleSave} disabled={saving || uploadingFoto} loading={saving}>
              {saving ? 'Guardando…' : 'Guardar expediente'}
            </Btn>
          </ModalActions>
        </>
      )}
    </Modal>
  )
}
