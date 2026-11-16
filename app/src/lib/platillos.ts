import { supabase } from '@/integrations/supabase/client'

export type Platillo = {
  id: string
  hotel_id: string
  sucursal_id: string | null
  nombre: string
  descripcion: string | null
  foto_path: string | null
  activo: boolean
  orden: number
  created_at: string
}

export type PlatilloPublico = Pick<Platillo, 'id' | 'nombre' | 'descripcion' | 'foto_path'>

export type CalificacionPlatillo = {
  id: string
  resena_id: string
  platillo_id: string
  estrellas: number
  comentario: string | null
  created_at: string
}

export type CalificacionNueva = { platillo_id: string; estrellas: number; comentario: string }

const BUCKET = 'platillos'

export function fotoPlatilloUrl(path: string | null) {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
}

export async function fetchPlatillosPublicos(link: string): Promise<PlatilloPublico[]> {
  const { data, error } = await supabase.rpc('get_platillos_publicos', { p_link: link })
  if (error) { console.error('Error cargando platillos:', error); return [] }
  return (data as PlatilloPublico[]) ?? []
}

export async function enviarCalificacionesPlatillos(link: string, resenaId: string, items: CalificacionNueva[]) {
  const { error } = await supabase.rpc('calificar_platillos', {
    p_link: link,
    p_resena_id: resenaId,
    p_items: items.map(i => ({ platillo_id: i.platillo_id, estrellas: i.estrellas, comentario: i.comentario.trim() || null })),
  })
  return error
}

// Reduce la foto a 1000 px de lado mayor en WebP: carga rápida en el teléfono del cliente
async function comprimir(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, 1000 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala)
  canvas.height = Math.round(bmp.height * escala)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la foto')), 'image/webp', 0.82))
}

export async function subirFotoPlatillo(hotelId: string, file: File): Promise<string> {
  const blob = await comprimir(file)
  const path = `${hotelId}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return path
}

export async function borrarFotoPlatillo(path: string) {
  await supabase.storage.from(BUCKET).remove([path])
}
