import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

type Rol = 'atlas_admin' | 'hotel_admin' | 'colaborador'

type Perfil = {
  id: string
  rol: Rol
  hotel_id: string | null
  colaborador_id: string | null
  activo?: boolean
}

type AuthContextType = {
  session: Session | null
  user: User | null
  perfil: Perfil | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  /** Motivo por el que se cerró la sesión (p. ej. acceso desactivado), para mostrarlo en el login */
  avisoLogin: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [avisoLogin, setAvisoLogin] = useState<string | null>(null)
  const perfilUserId = useRef<string | null>(null)

  useEffect(() => {
    // Solo usar onAuthStateChange — es suficiente, se dispara inmediatamente
    // con la sesión actual al montar, y luego en cada cambio
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        // Al volver a la pestaña Supabase reemite la sesión: si es el mismo usuario no recargues ni desmontes el panel
        if (perfilUserId.current === session.user.id) return
        await loadPerfil(session.user.id)
      } else {
        perfilUserId.current = null
        setPerfil(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPerfil(userId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        await supabase.auth.signOut()
        setPerfil(null)
      } else if ((data as Perfil).activo === false) {
        // Acceso desactivado: Supabase ya le quitó los permisos; aquí solo se cierra la sesión
        setAvisoLogin('Tu acceso está desactivado. Pídeselo a tu gerente o a tak!')
        await supabase.auth.signOut()
        setPerfil(null)
      } else {
        perfilUserId.current = userId
        setPerfil(data as Perfil)
      }
    } catch (e) {
      await supabase.auth.signOut()
      setPerfil(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    setAvisoLogin(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return /banned/i.test(error.message) ? 'desactivado' : error.message
    return null
  }

  async function signOut() {
    perfilUserId.current = null
    try { Object.keys(sessionStorage).filter(k => k.startsWith('tak:')).forEach(k => sessionStorage.removeItem(k)) } catch { /* sin almacenamiento */ }
    setLoading(false)
    await supabase.auth.signOut()
    setPerfil(null)
    setSession(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, perfil, loading, signIn, signOut, avisoLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
