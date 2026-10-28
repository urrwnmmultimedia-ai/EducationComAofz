import { supabase } from '@/lib/supabase'
import type { AssignmentRow } from '@/lib/database.types'

export interface StudentStats {
  totalXp: number
  badgeCount: number
  pending: AssignmentRow[] // งานที่ยังไม่ส่ง เรียงตามกำหนดส่ง
}

export async function fetchStudentStats(studentId: string): Promise<StudentStats> {
  const [xp, badges, assignments, submissions] = await Promise.all([
    supabase.from('xp_events').select('xp').eq('student_id', studentId),
    supabase.from('student_badges').select('badge_id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('assignments').select('*'),
    supabase.from('submissions').select('assignment_id, status').eq('student_id', studentId),
  ])
  if (xp.error) throw xp.error
  if (badges.error) throw badges.error
  if (assignments.error) throw assignments.error
  if (submissions.error) throw submissions.error

  const done = new Set(
    submissions.data.filter((s) => s.status === 'submitted' || s.status === 'graded').map((s) => s.assignment_id),
  )
  const pending = assignments.data
    .filter((a) => !done.has(a.id) && a.type !== 'score_only')
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))

  return {
    totalXp: xp.data.reduce((sum, e) => sum + e.xp, 0),
    badgeCount: badges.count ?? 0,
    pending,
  }
}

// "อีก 2 วัน" / "อีก 5 ชั่วโมง" / "เลยกำหนด 1 วัน"
export function dueCountdown(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return 'ไม่มีกำหนดส่ง'
  const diffMs = new Date(dueAt).getTime() - now.getTime()
  const late = diffMs < 0
  const abs = Math.abs(diffMs)
  const hours = Math.floor(abs / 3_600_000)
  const days = Math.floor(hours / 24)
  const text = days >= 1 ? `${days} วัน` : hours >= 1 ? `${hours} ชั่วโมง` : `${Math.max(1, Math.floor(abs / 60_000))} นาที`
  return late ? `เลยกำหนด ${text}` : `อีก ${text}`
}
