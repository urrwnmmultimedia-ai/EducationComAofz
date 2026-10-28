import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  ensureAnonymousSession,
  fetchIdentity,
  loginWithCode,
  logoutAndReset,
  type Identity,
  type LoginResult,
} from '@/features/auth/authApi'

type AuthStatus = 'loading' | 'ready' | 'error' | 'unconfigured'

interface AuthContextValue {
  status: AuthStatus
  identity: Identity
  login: (code: string) => Promise<LoginResult>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const EMPTY: Identity = { role: null, student: null }

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'unconfigured')
  const [identity, setIdentity] = useState<Identity>(EMPTY)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      await ensureAnonymousSession()
      setIdentity(await fetchIdentity())
      setStatus('ready')
    } catch (err) {
      console.error('[auth] init failed', err)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (code: string) => {
    try {
      await ensureAnonymousSession()
      const result = await loginWithCode(code)
      if (result.ok) setIdentity(result.identity)
      return result
    } catch (err) {
      console.error('[auth] login failed', err)
      return { ok: false, error: 'network' } as const
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutAndReset()
    } finally {
      setIdentity(EMPTY)
    }
  }, [])

  const value = useMemo(
    () => ({ status, identity, login, logout, refresh }),
    [status, identity, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
