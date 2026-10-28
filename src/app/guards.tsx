import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from './AuthContext'
import { homePathFor, type Course, type Role } from '@/features/auth/authApi'
import { FullPageMessage } from '@/components/FullPageMessage'

// course: นักเรียนต้องอยู่ห้องของวิชานี้ ไม่ใช่ก็พากลับหน้าแรกของวิชาตัวเอง (ครูผ่านได้ทุกวิชา)
export function RequireRole({ role, course, children }: { role: Role | Role[]; course?: Course; children: ReactNode }) {
  const { status, identity } = useAuth()
  const allowed = Array.isArray(role) ? role : [role]
  if (status === 'loading') return <FullPageMessage loading title="กำลังโหลด…" />
  if (!identity.role || !allowed.includes(identity.role)) return <Navigate to="/" replace />
  if (course && identity.role === 'student' && identity.student?.course !== course) {
    return <Navigate to={homePathFor(identity)} replace />
  }
  return <>{children}</>
}
