import { supabase } from '@/integrations/supabase/client'

const EDGE_FN_URL = 'https://tlwqvpukzinkcscpudmc.supabase.co/functions/v1/crear-usuario'

type CrearUsuarioParams = {
  email: string
  password: string
  rol: 'atlas_admin' | 'hotel_admin' | 'colaborador'
  hotel_id?: string | null
  colaborador_id?: string | null
}

export async function crearUsuario(params: CrearUsuarioParams): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return 'No hay sesión activa'

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  })

  const json = await res.json()
  if (!res.ok || json.error) return json.error ?? 'Error desconocido'
  return null
}
