// Edge Function crear-usuario (Supabase). Copia versionada: se despliega pegándola en
// Supabase → Edge Functions → crear-usuario → Code → Deploy.
// Requiere la migración 2026-11-24_accesos.sql (columna perfiles.activo).
//
// Corrección de seguridad 2026-11-19: antes, cualquier rol distinto de hotel_admin (p. ej. colaborador)
// se saltaba las comprobaciones y podía crear cuentas atlas_admin.
//
// 2026-11-24: además de crear, administra accesos. Campo "accion" en el cuerpo:
//   crear (por defecto) | listar | desactivar | reactivar | restablecer
// Permisos (siempre se leen del perfil de quien llama, nunca de lo que manda el navegador):
//   atlas_admin -> todos los accesos, de cualquier rol (menos desactivarse a sí mismo)
//   hotel_admin -> solo accesos de COLABORADOR de su propio negocio (ve también los gerentes de su negocio)
//   colaborador -> nada
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES = ['atlas_admin', 'hotel_admin', 'colaborador'] as const
type Rol = typeof ROLES[number]
type Perfil = { id: string; rol: Rol; hotel_id: string | null; colaborador_id: string | null; activo: boolean }

// Bloqueo "permanente" (100 años). Al reactivar se usa 'none'.
const BAN_PERMANENTE = '876000h'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const esUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

function validarPassword(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < 8 || p.length > 128) return 'La contraseña debe tener al menos 8 caracteres'
  return null
}

// ¿Quien llama puede administrar este acceso?
function puedeAdministrar(yo: Perfil, objetivo: Perfil): boolean {
  if (yo.rol === 'atlas_admin') return true
  if (yo.rol === 'hotel_admin') return objetivo.rol === 'colaborador' && !!yo.hotel_id && objetivo.hotel_id === yo.hotel_id
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Quién llama (antes de leer el cuerpo)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'No autorizado' }, 401)

    const { data: yo } = await admin.from('perfiles').select('id, rol, hotel_id, colaborador_id, activo').eq('id', user.id).single<Perfil>()
    // Solo administradores de tak! y gerentes, con el acceso activo. Todo lo demás se rechaza.
    if (!yo || !yo.activo || (yo.rol !== 'atlas_admin' && yo.rol !== 'hotel_admin')) return json({ error: 'No autorizado' }, 403)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Datos inválidos' }, 400)
    const accion = typeof body.accion === 'string' ? body.accion : 'crear'

    if (accion === 'crear') return await crear(admin, yo, body)
    if (accion === 'listar') return await listar(admin, yo)

    // Acciones sobre un acceso existente
    if (!esUuid(body.user_id)) return json({ error: 'Datos inválidos' }, 400)
    const { data: objetivo } = await admin.from('perfiles').select('id, rol, hotel_id, colaborador_id, activo').eq('id', body.user_id).maybeSingle<Perfil>()
    if (!objetivo || !puedeAdministrar(yo, objetivo)) return json({ error: 'No autorizado para este acceso' }, 403)

    if (accion === 'desactivar' || accion === 'reactivar') {
      const activo = accion === 'reactivar'
      if (!activo && objetivo.id === yo.id) return json({ error: 'No puedes desactivar tu propio acceso' }, 400)
      const { error: e1 } = await admin.auth.admin.updateUserById(objetivo.id, { ban_duration: activo ? 'none' : BAN_PERMANENTE })
      if (e1) return json({ error: e1.message }, 400)
      const { error: e2 } = await admin.from('perfiles').update({ activo }).eq('id', objetivo.id)
      if (e2) return json({ error: 'No se pudo actualizar el perfil' }, 400)
      return json({ ok: true })
    }

    if (accion === 'restablecer') {
      const errPass = validarPassword(body.password)
      if (errPass) return json({ error: errPass }, 400)
      // cambiar_password: el panel le pide elegir una nueva al entrar
      const { error: e } = await admin.auth.admin.updateUserById(objetivo.id, {
        password: body.password,
        user_metadata: { cambiar_password: true },
      })
      if (e) return json({ error: e.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Acción no válida' }, 400)
  } catch (e) {
    console.error('crear-usuario', e)
    return json({ error: 'Error interno' }, 500)
  }
})

async function crear(admin: SupabaseClient, yo: Perfil, body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = body.password
  const rol = body.rol as Rol
  const hotel_id: string | null = typeof body.hotel_id === 'string' && body.hotel_id ? body.hotel_id : null
  const colaborador_id: string | null = typeof body.colaborador_id === 'string' && body.colaborador_id ? body.colaborador_id : null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return json({ error: 'Correo inválido' }, 400)
  const errPass = validarPassword(password)
  if (errPass) return json({ error: errPass }, 400)
  if (!ROLES.includes(rol)) return json({ error: 'Rol inválido' }, 400)

  // Permisos según quién llama
  if (yo.rol === 'hotel_admin') {
    // Un gerente solo crea colaboradores de su propio negocio
    if (rol !== 'colaborador') return json({ error: 'No autorizado para este rol' }, 403)
    if (!yo.hotel_id || hotel_id !== yo.hotel_id) return json({ error: 'No autorizado para este negocio' }, 403)
  }

  // Coherencia del rol con negocio y colaborador
  if (rol === 'atlas_admin' && (hotel_id || colaborador_id)) return json({ error: 'Datos inválidos' }, 400)
  if (rol === 'hotel_admin' && (!hotel_id || colaborador_id)) return json({ error: 'Selecciona un negocio' }, 400)
  if (rol === 'colaborador') {
    if (!hotel_id || !colaborador_id) return json({ error: 'Selecciona el colaborador' }, 400)
    // El colaborador debe pertenecer a ese negocio
    const { data: col } = await admin.from('colaboradores').select('id')
      .eq('id', colaborador_id).eq('hotel_id', hotel_id).maybeSingle()
    if (!col) return json({ error: 'El colaborador no pertenece a este negocio' }, 403)
    // Un colaborador, un solo acceso
    const { data: ya } = await admin.from('perfiles').select('id').eq('colaborador_id', colaborador_id).maybeSingle()
    if (ya) return json({ error: 'Este colaborador ya tiene acceso' }, 409)
  }
  if (rol === 'hotel_admin') {
    const { data: h } = await admin.from('hotels').select('id').eq('id', hotel_id).maybeSingle()
    if (!h) return json({ error: 'Negocio no encontrado' }, 400)
  }

  // Crear usuario y perfil. La contraseña es temporal: al entrar se le pide una nueva.
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: password as string,
    email_confirm: true,
    user_metadata: { cambiar_password: true },
  })
  if (createError || !newUser?.user) {
    const yaExiste = /already|registered|exists/i.test(createError?.message ?? '')
    return json({ error: yaExiste ? 'Ya existe una cuenta con ese correo' : createError?.message ?? 'No se pudo crear el usuario' }, 400)
  }

  const { error: perfilError } = await admin.from('perfiles').insert({
    id: newUser.user.id,
    rol,
    hotel_id: rol === 'atlas_admin' ? null : hotel_id,
    colaborador_id: rol === 'colaborador' ? colaborador_id : null,
    activo: true,
  })
  if (perfilError) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    return json({ error: 'No se pudo crear el perfil' }, 400)
  }

  return json({ ok: true, user_id: newUser.user.id })
}

// Lista de accesos con correo y último ingreso (eso vive en Auth, solo lo lee service_role)
async function listar(admin: SupabaseClient, yo: Perfil) {
  let q = admin.from('perfiles').select('id, rol, hotel_id, colaborador_id, activo').limit(1000)
  if (yo.rol === 'hotel_admin') {
    if (!yo.hotel_id) return json({ accesos: [] })
    // El gerente ve los accesos de su negocio (gerentes y colaboradores); solo administra colaboradores
    q = q.eq('hotel_id', yo.hotel_id).in('rol', ['hotel_admin', 'colaborador'])
  }
  const { data: perfiles, error } = await q
  if (error) return json({ error: 'No se pudieron leer los accesos' }, 400)

  const lista = (perfiles ?? []) as Perfil[]
  const accesos = []
  // De 10 en 10 para no saturar la API de Auth
  for (let i = 0; i < lista.length; i += 10) {
    const lote = await Promise.all(lista.slice(i, i + 10).map(async p => {
      const { data } = await admin.auth.admin.getUserById(p.id)
      const u = data?.user
      return {
        id: p.id,
        rol: p.rol,
        hotel_id: p.hotel_id,
        colaborador_id: p.colaborador_id,
        activo: p.activo,
        email: u?.email ?? null,
        ultimo_ingreso: u?.last_sign_in_at ?? null,
        creado: u?.created_at ?? null,
        cambiar_password: !!u?.user_metadata?.cambiar_password,
        administrable: puedeAdministrar(yo, p) && p.id !== yo.id,
      }
    }))
    accesos.push(...lote)
  }
  return json({ accesos })
}
