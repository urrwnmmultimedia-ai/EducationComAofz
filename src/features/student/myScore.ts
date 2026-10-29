import type { AssignmentRow } from '@/lib/database.types'
import { computeStudentScore } from '@/lib/scoring'
import { fetchMyGradebook } from '@/features/assignments/assignmentsApi'
import { entriesFor, fetchSettings, policyFromSettings, sortAssignments, toScoredItems } from '@/features/assignments/gradebookData'

// สมุดคะแนนของนักเรียน + คะแนนรวม 0–100 (ใช้ทั้งแท็บคะแนน และวิวัฒนาการในหน้าหลัก)
export async function fetchMyScore(studentId: string) {
  const [book, settings] = await Promise.all([fetchMyGradebook(studentId), fetchSettings()])
  const policy = policyFromSettings(settings)
  // RPC คืนเฉพาะคอลัมน์ที่จำเป็น เติมค่าที่เหลือให้ครบชนิด
  const assignments = sortAssignments(
    book.assignments.map((a) => ({ ...a, unit_id: null, instructions_md: '', rubric: [], config: {}, created_at: '' }) as AssignmentRow),
  )
  const entries = entriesFor(studentId, book.submissions)
  const score = computeStudentScore(toScoredItems(assignments), entries, policy, book.totalXp)
  return { submissions: book.submissions, totalXp: book.totalXp, assignments, entries, policy, score }
}
