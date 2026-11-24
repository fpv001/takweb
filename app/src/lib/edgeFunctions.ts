import { supabase } from '@/integrations/supabase/client'

const EDGE_FN_URL = 'https://tlwqvpukzinkcscpudmc.supabase.co/functions/v1/crear-usuario'

export type RolAcceso = 'atlas_admin' | 'hotel_admin' | 'colaborador'

export const ROL_LABEL: Record<RolAcceso, string> = {
  atlas_admin: 'Admin de tak!',
  hotel_admin: 'Gerente',
  colaborador: 'Colaborador',
}

type CrearUsuarioParams = {
  email: string
  password: string
  rol: RolAcceso
  hotel_id?: string | null
  colaborador_id?: string | null
}

export type Acceso = {
  id: string
  rol: RolAcceso
  hotel_id: string | null
  colaborador_id: string | null
  activo: boolean
  email: string | null
  ultimo_ingreso: string | null
  creado: string | null
  cambiar_password: boolean
  administrable: boolean
}

// Llama a la Edge Function con la sesión actual. Los permisos los valida el servidor.
async function llamar<T = { ok: true }>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No hay sesión activa' }
  try {
    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) return { error: json.error ?? 'Error desconocido' }
    return { data: json as T }
  } catch {
    return { error: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.' }
  }
}

export async function crearUsuario(params: CrearUsuarioParams): Promise<string | null> {
  const r = await llamar({ accion: 'crear', ...params })
  return r.error ?? null
}

export async function listarAccesos(): Promise<{ accesos: Acceso[]; error?: string }> {
  const r = await llamar<{ accesos: Acceso[] }>({ accion: 'listar' })
  return { accesos: r.data?.accesos ?? [], error: r.error }
}

export async function cambiarEstadoAcceso(userId: string, activo: boolean): Promise<string | null> {
  const r = await llamar({ accion: activo ? 'reactivar' : 'desactivar', user_id: userId })
  return r.error ?? null
}

export async function restablecerPassword(userId: string, password: string): Promise<string | null> {
  const r = await llamar({ accion: 'restablecer', user_id: userId, password })
  return r.error ?? null
}

// Contraseña temporal legible: sin caracteres que se confundan (l/1, O/0)
export function passwordTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  const s = Array.from(bytes, n => letras[n % letras.length]).join('')
  return `${s.slice(0, 5)}-${s.slice(5)}`
}
