import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Modal, ModalActions, FormField, Input, Btn, IconBtn, ActiveBadge, Alert, EmptyState, Skeleton, Avatar } from '@/components/UI'
import { Icon } from '@/components/Icon'

// ─── Types ────────────────────────────────────────────────────────────────────

type Equipo = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  hotel_id: string
}

type Miembro = {
  id: string
  equipo_id: string
  colaborador_id: string
  porcentaje_reparto: number
}

type Colaborador = {
  id: string
  nombre: string
  puesto: string | null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Props = { hotelId: string; colaboradores: Colaborador[] }

export function EquiposPanel({ hotelId, colaboradores }: Props) {
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Equipo | 'new' | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => { loadEquipos() }, [hotelId])

  async function loadEquipos() {
    setLoading(true)
    const [{ data: eqs }, { data: mbs }] = await Promise.all([
      supabase.from('equipos').select('*').eq('hotel_id', hotelId).order('nombre'),
      supabase.from('equipo_miembros').select('*'),
    ])
    setEquipos((eqs as Equipo[]) ?? [])
    setMiembros((mbs as Miembro[]) ?? [])
    setLoading(false)
  }

  if (loading) return (
    <div aria-busy="true" aria-label="Cargando equipos" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={72} r={20} /><Skeleton h={72} r={20} />
    </div>
  )

  return (
    <div>
      <div className="tk-sectionhead">
        <p className="tk-sectionhead__sub">
          {equipos.length} equipo{equipos.length !== 1 ? 's' : ''} configurado{equipos.length !== 1 ? 's' : ''}
        </p>
        <Btn icon="plus" onClick={() => setModal('new')}>Nuevo equipo</Btn>
      </div>

      {equipos.length === 0 ? (
        <EmptyState icon="split" title="Sin equipos configurados" text="Crea un equipo para definir cómo se reparten las propinas entre sus miembros." />
      ) : (
        equipos.map(eq => {
          const mbs = miembros.filter(m => m.equipo_id === eq.id)
          const totalPct = mbs.reduce((s, m) => s + m.porcentaje_reparto, 0)
          const isExpanded = expandido === eq.id

          return (
            <div key={eq.id} className="tk-team">
              {/* Header del equipo */}
              <div className="tk-team__head">
                <button
                  type="button" className="tk-team__toggle"
                  aria-expanded={isExpanded} aria-controls={`eq-${eq.id}`}
                  onClick={() => setExpandido(isExpanded ? null : eq.id)}
                >
                  <span className="tk-team__icon"><Icon name="users" /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="tk-list__name" style={{ display: 'block' }}>{eq.nombre}</span>
                    <span className="tk-list__meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                      <span>{mbs.length} miembro{mbs.length !== 1 ? 's' : ''} · <span className="tk-num">{totalPct}%</span> asignado</span>
                      {totalPct !== 100 && <span style={{ color: 'var(--warning)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="warning" size={14} />Debe sumar 100%</span>}
                    </span>
                    {mbs.length > 0 && (
                      <span className="tk-split" aria-hidden="true">
                        {mbs.map(m => <span key={m.id} style={{ width: `${m.porcentaje_reparto}%` }} />)}
                      </span>
                    )}
                  </span>
                  <Icon name="chevronDown" className="tk-chevron tk-team__chev" />
                </button>
                <ActiveBadge activo={eq.activo} />
                <IconBtn icon="edit" label={`Editar ${eq.nombre}`} onClick={e => { e.stopPropagation(); setModal(eq) }} />
              </div>

              {/* Miembros expandidos */}
              {isExpanded && (
                <div className="tk-team__body" id={`eq-${eq.id}`}>
                  {mbs.length === 0 ? (
                    <p className="tk-muted" style={{ font: 'var(--t-small)', textAlign: 'center', padding: '12px 0' }}>
                      Sin miembros. Edita el equipo para agregar colaboradores.
                    </p>
                  ) : (
                    mbs.map(m => {
                      const col = colaboradores.find(c => c.id === m.colaborador_id)
                      return (
                        <div key={m.id} className="tk-member">
                          <Avatar name={col?.nombre ?? '?'} size={32} />
                          <div className="tk-list__main">
                            <p className="tk-list__name">{col?.nombre ?? '—'}</p>
                            <p className="tk-list__meta">{col?.puesto ?? ''}</p>
                          </div>
                          <div style={{ width: 96 }} className="tk-meter" aria-hidden="true">
                            <div className="tk-meter__fill" style={{ width: `${m.porcentaje_reparto}%` }} />
                          </div>
                          <span className="tk-list__amount" style={{ minWidth: 44, textAlign: 'right' }}>{m.porcentaje_reparto}%</span>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {modal !== null && (
        <EquipoModal
          equipo={modal === 'new' ? null : modal}
          hotelId={hotelId}
          colaboradores={colaboradores}
          miembrosExistentes={modal !== 'new' ? miembros.filter(m => m.equipo_id === (modal as Equipo).id) : []}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadEquipos() }}
        />
      )}
    </div>
  )
}

// ─── Modal de equipo ──────────────────────────────────────────────────────────

type MiembroInput = { colaborador_id: string; porcentaje_reparto: number }

function EquipoModal({ equipo, hotelId, colaboradores, miembrosExistentes, onClose, onSave }: {
  equipo: Equipo | null
  hotelId: string
  colaboradores: Colaborador[]
  miembrosExistentes: Miembro[]
  onClose: () => void
  onSave: () => void
}) {
  const [nombre, setNombre] = useState(equipo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(equipo?.descripcion ?? '')
  const [activo, setActivo] = useState(equipo?.activo ?? true)
  const [miembros, setMiembros] = useState<MiembroInput[]>(
    miembrosExistentes.map(m => ({ colaborador_id: m.colaborador_id, porcentaje_reparto: m.porcentaje_reparto }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalPct = miembros.reduce((s, m) => s + m.porcentaje_reparto, 0)
  const colsDisponibles = colaboradores.filter(c => !miembros.find(m => m.colaborador_id === c.id))

  function agregarMiembro(colaboradorId: string) {
    if (!colaboradorId) return
    setMiembros(prev => [...prev, { colaborador_id: colaboradorId, porcentaje_reparto: 0 }])
  }

  function actualizarPct(idx: number, pct: number) {
    setMiembros(prev => prev.map((m, i) => i === idx ? { ...m, porcentaje_reparto: Math.min(100, Math.max(0, pct)) } : m))
  }

  function removerMiembro(idx: number) {
    setMiembros(prev => prev.filter((_, i) => i !== idx))
  }

  function distribuirIgual() {
    if (!miembros.length) return
    const pct = Math.floor(100 / miembros.length)
    const resto = 100 - pct * miembros.length
    setMiembros(prev => prev.map((m, i) => ({ ...m, porcentaje_reparto: pct + (i === 0 ? resto : 0) })))
  }

  async function handleSave() {
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    if (miembros.length > 0 && totalPct !== 100) { setError('Los porcentajes deben sumar exactamente 100%'); return }
    setSaving(true)
    setError('')

    try {
      let equipoId = equipo?.id

      if (equipo) {
        await supabase.from('equipos').update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, activo }).eq('id', equipo.id)
        await supabase.from('equipo_miembros').delete().eq('equipo_id', equipo.id)
      } else {
        const { data, error: err } = await supabase.from('equipos').insert({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, hotel_id: hotelId, activo: true }).select().single()
        if (err) throw err
        equipoId = (data as Equipo).id
      }

      if (miembros.length > 0 && equipoId) {
        await supabase.from('equipo_miembros').insert(
          miembros.map(m => ({ equipo_id: equipoId, colaborador_id: m.colaborador_id, porcentaje_reparto: m.porcentaje_reparto }))
        )
      }

      onSave()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={equipo ? 'Editar equipo' : 'Nuevo equipo'} onClose={onClose} wide>
      <div className="tk-form-grid">
        <FormField label="Nombre del equipo">
          <Input value={nombre} onChange={setNombre} placeholder="Limpieza, Spa, Recepción…" />
        </FormField>
        <FormField label="Descripción" hint="Opcional">
          <Input value={descripcion} onChange={setDescripcion} placeholder="Ej. Ama de llaves, pisos 1 a 5" />
        </FormField>
      </div>

      {/* Miembros */}
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px', minWidth: 0 }} aria-labelledby="reparto-title">
        <div className="tk-sectionhead" style={{ marginBottom: 8 }}>
          <span id="reparto-title" className="tk-field__label">Reparto de propinas</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`tk-total ${totalPct === 100 ? 'is-ok' : totalPct > 100 ? 'is-over' : 'is-under'}`} aria-live="polite">
              <Icon name={totalPct === 100 ? 'success' : 'warning'} size={16} />
              {totalPct}% de 100%
            </span>
            {miembros.length > 1 && (
              <Btn small variant="text" onClick={distribuirIgual}>Repartir igual</Btn>
            )}
          </div>
        </div>
        <div className="tk-meter" style={{ marginBottom: 12 }} aria-hidden="true">
          <div className="tk-meter__fill" style={{ width: `${Math.min(100, totalPct)}%`, background: totalPct > 100 ? 'var(--danger)' : totalPct === 100 ? 'var(--success)' : undefined }} />
        </div>

        {/* Lista de miembros */}
        {miembros.map((m, idx) => {
          const col = colaboradores.find(c => c.id === m.colaborador_id)
          return (
            <div key={m.colaborador_id} className="tk-member">
              <Avatar name={col?.nombre ?? '?'} size={32} />
              <div className="tk-list__main">
                <p className="tk-list__name">{col?.nombre ?? '—'}</p>
                <p className="tk-list__meta">{col?.puesto ?? ''}</p>
              </div>
              <span className="tk-member__pct tk-input-wrap">
                <input
                  className="tk-input"
                  type="number" min={0} max={100} inputMode="numeric"
                  aria-label={`Porcentaje para ${col?.nombre ?? 'colaborador'}`}
                  value={m.porcentaje_reparto}
                  onChange={e => actualizarPct(idx, Number(e.target.value))}
                />
                <span className="tk-input-wrap__suffix">%</span>
              </span>
              <IconBtn small danger icon="close" label={`Quitar a ${col?.nombre ?? 'colaborador'}`} onClick={() => removerMiembro(idx)} />
            </div>
          )
        })}

        {/* Agregar miembro */}
        {colsDisponibles.length > 0 && (
          <select
            className="tk-select tk-select--add"
            aria-label="Agregar colaborador al equipo"
            value=""
            onChange={e => { agregarMiembro(e.target.value); e.target.value = '' }}
            style={{ marginTop: 8 }}
          >
            <option value="">+ Agregar colaborador al equipo</option>
            {colsDisponibles.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.puesto ?? 'Sin puesto'}</option>)}
          </select>
        )}
      </fieldset>

      {equipo && (
        <label className="tk-check" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
          Equipo activo
        </label>
      )}

      {error && <Alert>{error}</Alert>}

      <ModalActions>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={saving} loading={saving}>{saving ? 'Guardando…' : 'Guardar equipo'}</Btn>
      </ModalActions>
    </Modal>
  )
}
