import { supabase } from '@/integrations/supabase/client'

// Fotos de perfil (colaboradores y pulseras tak!). Se suben como archivo, no como liga:
// el navegador recorta al centro en cuadro, reduce a 512 px y convierte a WebP, así que
// cualquier foto del teléfono (aunque pese 5 MB o sea HEIC convertida) entra bajo el límite de 2 MB.
//
// Nombre del archivo: <id>.<marca de tiempo>.webp
//   - Las reglas del bucket validan que lo de antes del primer punto sea un id que se puede gestionar.
//   - Un nombre nuevo en cada subida evita sobrescribir (no requiere permiso de update) y
//     rompe la caché del navegador sin trucos.

const LADO = 512
const MAX_ORIGINAL = 25 * 1024 * 1024

export async function fotoCuadrada(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Solo se permiten imágenes')
  if (file.size > MAX_ORIGINAL) throw new Error('La imagen es demasiado grande')
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file) } catch { throw new Error('No se pudo leer la imagen. Prueba con JPG o PNG') }
  const lado = Math.min(bmp.width, bmp.height)
  const destino = Math.min(LADO, lado)
  const canvas = document.createElement('canvas')
  canvas.width = destino
  canvas.height = destino
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, destino, destino)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo procesar la foto')), 'image/webp', 0.85))
}

async function subir(bucket: string, id: string, file: File): Promise<string> {
  const blob = await fotoCuadrada(file)
  const path = `${id}.${Date.now()}.webp`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Sube la foto de un colaborador y devuelve la URL pública para guardar en colaboradores.foto_url */
export function subirFotoColaborador(colaboradorId: string, file: File) {
  return subir('colaboradores', colaboradorId, file)
}

/** Sube la foto de una pulsera tak! y devuelve la URL pública para guardar en tak_tarjetas.foto_url */
export function subirFotoTarjeta(tarjetaId: string, file: File) {
  return subir('tak', tarjetaId, file)
}
