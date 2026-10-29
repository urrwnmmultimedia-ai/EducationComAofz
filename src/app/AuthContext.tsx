import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  ensureAnonymousSession,
  fetchIdentity,
  loginWithCode,
  logoutAndReset,
  type Identity,
  type LoginResult,
} from '@/features/auth/authApi'
import { classifyError, retryDelayMs, sleep } from '@/features/auth/connection'

// busy = Supabase จำกัดจำนวนครั้งต่อ IP (ทั้งห้องเข้าพร้อมกัน) — ระบบรอแล้วลองใหม่ให้เอง
type AuthStatus = 'loading' | 'ready' | 'error' | 'busy' | 'unconfigured'

// ลองต่อระบบซ้ำกี่ครั้งก่อนยอมแสดงหน้าผิดพลาด (busy รอนานกว่าและลองมากกว่า)
const MAX_TRIES = { busy: 6, network: 3, auth: 2 } as const

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

  // รอบล่าสุดเท่านั้นที่เปลี่ยนสถานะได้ (กดลองใหม่ระหว่างที่ยังรออยู่)
  const run = useRef(0)
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const mine = ++run.current
    for (let attempt = 0; ; attempt++) {
      try {
        await ensureAnonymousSession()
        const who = await fetchIdentity()
        if (run.current !== mine) return
        setIdentity(who)
        setStatus('ready')
        return
      } catch (err) {
        if (run.current !== mine) return
        const problem = classifyError(err)
        console.error(`[auth] init failed (${problem}, try ${attempt + 1})`, err)
        if (attempt + 1 >= MAX_TRIES[problem]) {
          setStatus(problem === 'busy' ? 'busy' : 'error')
          return
        }
        if (problem === 'busy') setStatus('busy')
        await sleep(retryDelayMs(problem, attempt))
        if (run.current !== mine) return
      }
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
      return { ok: false, error: classifyError(err) === 'busy' ? 'busy' : 'network' } as const
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
