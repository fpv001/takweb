import { useEffect, useRef, useState } from 'react'
import { Avatar, Btn } from '@/components/UI'
import { Icon } from '@/components/Icon'

// Selector de foto de perfil para formularios. No sube nada: devuelve el archivo elegido y el
// formulario lo sube al guardar (así funciona también al crear, cuando aún no hay id).
//   value    -> foto actual guardada (URL) o null
//   file     -> archivo elegido y aún sin guardar
//   onChange -> nuevo archivo, o null + quitar=true para borrar la foto

type Props = {
  nombre: string
  value: string | null
  file: File | null
  quitada?: boolean
  onChange: (file: File | null, quitar?: boolean) => void
  size?: number
}

export function FotoPicker({ nombre, value, file, quitada, onChange, size = 72 }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = preview ?? (quitada ? null : value)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
      <div className="tk-dossier__photo">
        <Avatar name={nombre || '?'} src={src} size={size} />
        <button type="button" className="tk-dossier__cam" aria-label="Elegir foto" title="Elegir foto" onClick={() => ref.current?.click()}>
          <Icon name="camera" />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <Btn small variant="secondary" icon="camera" onClick={() => ref.current?.click()}>{src ? 'Cambiar foto' : 'Subir foto'}</Btn>
        {src && <Btn small variant="text" icon="trash" onClick={() => { onChange(null, true); if (ref.current) ref.current.value = '' }}>Quitar</Btn>}
        <span className="tk-muted" style={{ fontSize: 12 }}>Desde tu galería o cámara. Se recorta en cuadro.</span>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f) }} />
    </div>
  )
}
