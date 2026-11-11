import type { AssignmentRow } from '@/lib/database.types'
import { computeStudentScore } from '@/lib/scoring'
import { fetchMyGradebook } from '@/features/assignments/assignmentsApi'
import { fetchGameScores, gameItems, withGameEntries } from '@/features/assignments/gameScores'
import { entriesFor, fetchSettings, policyFromSettings, sortAssignments, toScoredItems } from '@/features/assignments/gradebookData'

// สมุดคะแนนของนักเรียน + คะแนนรวม 0–100 (แท็บคะแนน และการ์ดวิวัฒนาการใช้ตัวเลขเดียวกัน)
export async function fetchMyScore(studentId: string) {
  const [book, settings, games] = await Promise.all([fetchMyGradebook(studentId), fetchSettings(), fetchGameScores(studentId)])
  const policy = policyFromSettings(settings)
  // RPC คืนเฉพาะคอลัมน์ที่จำเป็น เติมค่าที่เหลือให้ครบชนิด
  const assignments = sortAssignments(
    book.assignments.map((a) => ({ ...a, unit_id: null, instructions_md: '', rubric: [], config: {}, created_at: '' }) as AssignmentRow),
  )
  const entries = entriesFor(studentId, book.submissions)
  // งาน + เกมประจำคาบ (คาบละส่วนเท่ากัน) → คะแนนรวมเดียวกับสมุดคะแนนของครู
  const items = [...toScoredItems(assignments), ...gameItems(games)]
  const score = computeStudentScore(items, withGameEntries(studentId, entries, games), policy, book.totalXp)
  return { submissions: book.submissions, totalXp: book.totalXp, assignments, entries, policy, score }
}
