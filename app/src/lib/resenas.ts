import { supabase } from '@/integrations/supabase/client'

export type Resena = {
  id: string
  hotel_id: string | null
  colaborador_id: string | null
  propina_id: string | null
  punto_id: string | null
  estrellas: number | null
  comentario: string | null
  publica: boolean
  created_at: string
}

// Supabase devuelve como máximo 1000 filas por consulta, así que se pagina hasta traer todas.
// propinaIds incluye reseñas antiguas que solo están ligadas a una propina.
export async function fetchResenas(filtro: { hotel_id: string } | { colaborador_id: string }, propinaIds: string[] = []): Promise<Resena[]> {
  const base = 'hotel_id' in filtro ? `hotel_id.eq.${filtro.hotel_id}` : `colaborador_id.eq.${filtro.colaborador_id}`
  const condiciones = [base, ...(propinaIds.length ? [`propina_id.in.(${propinaIds.join(',')})`] : [])].join(',')
  const PAGINA = 1000
  const todas: Resena[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase.from('resenas').select('*').or(condiciones)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + PAGINA - 1)
    if (error) { console.error('Error cargando reseñas:', error); break }
    const filas = (data as Resena[]) ?? []
    todas.push(...filas)
    if (filas.length < PAGINA) break
  }
  return todas
}
