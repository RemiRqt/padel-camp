import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, phone, role, balance, balance_bonus, license_number, avatar_url, created_at')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Auth] fetchProfile error:', error.message, error.code)
      // Profile not found — trigger may be slow, retry once
      if (error.code === 'PGRST116') {
        await new Promise((r) => setTimeout(r, 1500))
        const retry = await supabase
          .from('profiles')
          .select('id, display_name, email, phone, role, balance, balance_bonus, license_number, avatar_url, created_at')
          .eq('id', userId)
          .single()
        if (!retry.error && retry.data) {
          setProfile(retry.data)
          return retry.data
        }
        console.error('[Auth] fetchProfile retry failed:', retry.error?.message)
      }
      setProfile(null)
      return null
    }

    setProfile(data)
    return data
  }, [])

  // Init: restore session on page load / refresh
  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (cancelled) return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }

    init()

    // Listen for auth events to keep session in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
      if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
        setUser(session.user)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Immediately set user and fetch profile — don't rely on onAuthStateChange
    setUser(data.user)
    const prof = await fetchProfile(data.user.id)
    return { user: data.user, profile: prof }
  }

  const signUp = async (email, password, displayName, phone) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, phone } },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signUp, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
