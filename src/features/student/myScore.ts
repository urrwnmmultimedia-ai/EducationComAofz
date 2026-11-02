import type { AssignmentRow } from '@/lib/database.types'
import { computeSoFarScore, computeStudentScore } from '@/lib/scoring'
import { fetchSessionList } from '@/features/lessons/lessonsApi'
import { fetchMyGradebook } from '@/features/assignments/assignmentsApi'
import { entriesFor, fetchSettings, policyFromSettings, sortAssignments, toScoredItems } from '@/features/assignments/gradebookData'

// สมุดคะแนนของนักเรียน + คะแนนรวม 0–100 (แท็บคะแนน) + คะแนนที่ทำได้ตอนนี้ (วิวัฒนาการ)
export async function fetchMyScore(studentId: string) {
  const [book, settings, sessions] = await Promise.all([fetchMyGradebook(studentId), fetchSettings(), fetchSessionList()])
  const policy = policyFromSettings(settings)
  // RPC คืนเฉพาะคอลัมน์ที่จำเป็น เติมค่าที่เหลือให้ครบชนิด
  const assignments = sortAssignments(
    book.assignments.map((a) => ({ ...a, unit_id: null, instructions_md: '', rubric: [], config: {}, created_at: '' }) as AssignmentRow),
  )
  const entries = entriesFor(studentId, book.submissions)
  const items = toScoredItems(assignments)
  const score = computeStudentScore(items, entries, policy, book.totalXp)
  // คาบที่ครูเปิดให้ห้องแล้ว (ครูดูตัวอย่าง = ทุกคาบเปิด)
  const open = new Set(sessions.filter((s) => s.is_unlocked).map((s) => s.session_no))
  const soFar = computeSoFarScore(items, entries, policy, open)
  return { submissions: book.submissions, totalXp: book.totalXp, assignments, entries, policy, score, soFar }
}
