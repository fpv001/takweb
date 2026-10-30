import { supabase } from '@/integrations/supabase/client'

// Misma base de URL de propina para todos los paneles
export const TIP_BASE_URL = `${import.meta.env.VITE_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/tip`

// Misma base para los docks de reseñas: ${base}/r/${link_unico}
export const RESENA_BASE_URL = `${import.meta.env.VITE_WEB_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/r`

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
// no reintenta: devuelve mensajeDuplicado.
export async function insertarConLink(
  tabla: string,
  datos: Record<string, unknown>,
  link: string,
  linkManual: boolean,
  mensajeDuplicado = 'Ya existe un colaborador con ese enlace',
): Promise<{ error?: string }> {
  const intentar = (l: string) => supabase.from(tabla).insert({ ...datos, link_unico: l })
  const esDuplicado = (e: { code?: string } | null) => e?.code === '23505'

  const { error } = await intentar(link)
  if (!error) return {}
  if (!esDuplicado(error)) return { error: error.message }
  if (linkManual) return { error: mensajeDuplicado }

  const base = truncarSlug(link, 75)
  for (let i = 0; i < 3; i++) {
    const { error: e2 } = await intentar(`${base}-${sufijoAleatorio()}`)
    if (!e2) return {}
    if (!esDuplicado(e2)) return { error: e2.message }
  }
  return { error: 'No se pudo generar un enlace único, intenta de nuevo' }
}

// Colaboradores: envoltorio de insertarConLink, mismo comportamiento que antes
export function insertarColaborador(datos: Record<string, unknown>, link: string, linkManual: boolean) {
  return insertarConLink('colaboradores', datos, link, linkManual)
}
