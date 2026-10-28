import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import type { Role } from '@/features/auth/authApi'
import { FullPageMessage } from '@/components/FullPageMessage'

export function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { status, identity } = useAuth()
  const allowed = Array.isArray(role) ? role : [role]
  if (status === 'loading') return <FullPageMessage loading title="กำลังโหลด…" />
  if (!identity.role || !allowed.includes(identity.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
