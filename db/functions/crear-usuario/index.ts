// Edge Function crear-usuario (Supabase). Copia versionada: se despliega pegándola en
// Supabase → Edge Functions → crear-usuario → Code → Deploy.
// Corrección de seguridad 2026-11-19: antes, cualquier rol distinto de hotel_admin (p. ej. colaborador)
// se saltaba las comprobaciones y podía crear cuentas atlas_admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES = ['atlas_admin', 'hotel_admin', 'colaborador'] as const
type Rol = typeof ROLES[number]

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Quién llama (antes de leer el cuerpo)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return json({ error: 'No autorizado' }, 401)

    const { data: perfil } = await supabaseAdmin.from('perfiles').select('rol, hotel_id').eq('id', user.id).single()
    if (!perfil) return json({ error: 'No autorizado' }, 403)

    // Solo administradores de tak! y gerentes pueden crear accesos. Todo lo demás se rechaza.
    if (perfil.rol !== 'atlas_admin' && perfil.rol !== 'hotel_admin') return json({ error: 'No autorizado' }, 403)

    // 2. Validar datos
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Datos inválidos' }, 400)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const rol = body.rol as Rol
    const hotel_id: string | null = typeof body.hotel_id === 'string' && body.hotel_id ? body.hotel_id : null
    const colaborador_id: string | null = typeof body.colaborador_id === 'string' && body.colaborador_id ? body.colaborador_id : null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: 'Correo inválido' }, 400)
    if (password.length < 8 || password.length > 128) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    if (!ROLES.includes(rol)) return json({ error: 'Rol inválido' }, 400)

    // 3. Permisos según quién llama
    if (perfil.rol === 'hotel_admin') {
      // Un gerente solo crea colaboradores de su propio negocio
      if (rol !== 'colaborador') return json({ error: 'No autorizado para este rol' }, 403)
      if (!perfil.hotel_id || hotel_id !== perfil.hotel_id) return json({ error: 'No autorizado para este negocio' }, 403)
    }

    // 4. Coherencia del rol con negocio y colaborador
    if (rol === 'atlas_admin' && (hotel_id || colaborador_id)) return json({ error: 'Datos inválidos' }, 400)
    if (rol === 'hotel_admin' && (!hotel_id || colaborador_id)) return json({ error: 'Selecciona un negocio' }, 400)
    if (rol === 'colaborador') {
      if (!hotel_id || !colaborador_id) return json({ error: 'Selecciona el colaborador' }, 400)
      // El colaborador debe pertenecer a ese negocio
      const { data: col } = await supabaseAdmin.from('colaboradores').select('id')
        .eq('id', colaborador_id).eq('hotel_id', hotel_id).maybeSingle()
      if (!col) return json({ error: 'El colaborador no pertenece a este negocio' }, 403)
      // Un colaborador, un solo acceso
      const { data: ya } = await supabaseAdmin.from('perfiles').select('id').eq('colaborador_id', colaborador_id).maybeSingle()
      if (ya) return json({ error: 'Este colaborador ya tiene acceso' }, 409)
    }
    if (rol === 'hotel_admin') {
      const { data: h } = await supabaseAdmin.from('hotels').select('id').eq('id', hotel_id).maybeSingle()
      if (!h) return json({ error: 'Negocio no encontrado' }, 400)
    }

    // 5. Crear usuario y perfil
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError || !newUser?.user) return json({ error: createError?.message ?? 'No se pudo crear el usuario' }, 400)

    const { error: perfilError } = await supabaseAdmin.from('perfiles').insert({
      id: newUser.user.id,
      rol,
      hotel_id: rol === 'atlas_admin' ? null : hotel_id,
      colaborador_id: rol === 'colaborador' ? colaborador_id : null,
    })
    if (perfilError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return json({ error: 'No se pudo crear el perfil' }, 400)
    }

    return json({ ok: true, user_id: newUser.user.id })
  } catch (e) {
    console.error('crear-usuario', e)
    return json({ error: 'Error interno' }, 500)
  }
})
