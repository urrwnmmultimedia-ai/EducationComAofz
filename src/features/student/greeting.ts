import type { StudentProfile } from '@/features/auth/authApi'

// "สวัสดี [ชื่อเล่น] ม.3/[ห้อง] เลขที่ [เลขที่]"
export function studentGreeting(s: Pick<StudentProfile, 'nickname' | 'first_name' | 'classroom_name' | 'number'>): string {
  const parts = [`สวัสดี ${s.nickname || s.first_name}`]
  if (s.classroom_name) parts.push(s.classroom_name)
  if (s.number != null) parts.push(`เลขที่ ${s.number}`)
  return parts.join(' ')
}
