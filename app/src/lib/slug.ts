import { supabase } from '@/integrations/supabase/client'

// Misma base de URL de propina para todos los paneles
export const TIP_BASE_URL = `${import.meta.env.VITE_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/tip`

// Misma base para los docks de reseñas: ${base}/r/${link_unico}
export const RESENA_BASE_URL = `${import.meta.env.VITE_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/r`

// Pulseras tak! de los admins: ${base}/k/${codigo}
export const TAK_BASE_URL = `${import.meta.env.VITE_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/k`

// Minúsculas, sin acentos, solo letras/números/guiones, sin guiones repetidos ni en los extremos
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Corta en un guion para no partir una palabra, sin pasar de max caracteres
export function truncarSlug(s: string, max: number): string {
  if (s.length <= max) return s
  const corte = s.slice(0, max + 1)
  const idx = corte.lastIndexOf('-')
  return (idx > 0 ? corte.slice(0, idx) : s.slice(0, max)).replace(/-+$/, '')
}

// nombre del colaborador + nombre del negocio, máximo 80 caracteres
export function linkColaborador(nombreColaborador: string, nombreNegocio: string): string {
  const base = [slugify(nombreColaborador), slugify(nombreNegocio)].filter(Boolean).join('-')
  return truncarSlug(base, 80)
}

// 4 caracteres a-z y 2-9, sin l, o, i (se confunden con 1 y 0)
const CARACTERES_SUFIJO = 'abcdefghjkmnpqrstuvwxyz23456789'

export function sufijoAleatorio(): string {
  const bytes = new Uint32Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, n => CARACTERES_SUFIJO[n % CARACTERES_SUFIJO.length]).join('')
}

// Inserta una fila con enlace único (colaboradores, puntos_resena...). Si el enlace autogenerado
// choca (23505), reintenta con sufijo hasta 3 veces. Si el enlace lo escribió el usuario a mano,
// no reintenta: devuelve mensajeDuplicado. Devuelve el id y el enlace final de la fila creada.
export async function insertarConLink(
  tabla: string,
  datos: Record<string, unknown>,
  link: string,
  linkManual: boolean,
  mensajeDuplicado = 'Ya existe un colaborador con ese enlace',
): Promise<{ error?: string; id?: string; link?: string }> {
  const intentar = async (l: string) => {
    const { data, error } = await supabase.from(tabla).insert({ ...datos, link_unico: l }).select('id').maybeSingle()
    return { error, id: (data as { id?: string } | null)?.id, link: l }
  }
  const esDuplicado = (e: { code?: string } | null) => e?.code === '23505'

  const r1 = await intentar(link)
  if (!r1.error) return { id: r1.id, link: r1.link }
  if (!esDuplicado(r1.error)) return { error: r1.error.message }
  if (linkManual) return { error: mensajeDuplicado }

  const base = truncarSlug(link, 75)
  for (let i = 0; i < 3; i++) {
    const r2 = await intentar(`${base}-${sufijoAleatorio()}`)
    if (!r2.error) return { id: r2.id, link: r2.link }
    if (!esDuplicado(r2.error)) return { error: r2.error.message }
  }
  return { error: 'No se pudo generar un enlace único, intenta de nuevo' }
}

// Colaboradores: envoltorio de insertarConLink, mismo comportamiento que antes
export function insertarColaborador(datos: Record<string, unknown>, link: string, linkManual: boolean) {
  return insertarConLink('colaboradores', datos, link, linkManual)
}
