import { supabase } from '@/lib/supabase'
import type { AppSettingsRow, AssignmentRow, StudentRow, SubmissionRow } from '@/lib/database.types'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  computeStudentScore,
  parseGradeScale,
  parseWeights,
  splitForPp5,
  type Category,
  type ScoreEntry,
  type ScoredItem,
  type ScoringPolicy,
  type StudentScore,
} from '@/lib/scoring'
import { formatGrade } from '@/lib/grade'

export function policyFromSettings(s: AppSettingsRow): ScoringPolicy {
  return {
    weights: parseWeights(s.score_weights),
    gradeScale: parseGradeScale(s.grade_scale),
    latePenaltyEnabled: s.late_penalty_enabled,
    latePenaltyPct: Number(s.late_penalty_pct),
    affectiveFullXp: s.affective_full_xp,
  }
}

export async function fetchSettings(): Promise<AppSettingsRow> {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

// เรียงตามหมวดในสมุดคะแนน แล้วตามคาบ
export function sortAssignments(list: AssignmentRow[]): AssignmentRow[] {
  const order = (c: string) => CATEGORIES.indexOf(c as Category)
  return [...list].sort(
    (a, b) => order(a.category) - order(b.category) || (a.session_no ?? 99) - (b.session_no ?? 99) || a.sort_order - b.sort_order,
  )
}

export function toScoredItems(list: AssignmentRow[]): ScoredItem[] {
  return list.map((a) => ({ id: a.id, category: a.category, maxScore: Number(a.max_score), dueAt: a.due_at }))
}

export function entriesFor(studentId: string, subs: SubmissionRow[]): Map<string, ScoreEntry> {
  const map = new Map<string, ScoreEntry>()
  for (const s of subs) {
    if (s.student_id !== studentId) continue
    // คะแนนที่ "ส่งคืนให้แก้" ยังไม่นับ
    const score = s.status === 'graded' && s.score != null ? Number(s.score) : null
    map.set(s.assignment_id, { score, submittedAt: s.submitted_at })
  }
  return map
}

export interface GradebookRow {
  student: StudentRow
  score: StudentScore
}

export function buildGradebook(
  students: StudentRow[],
  assignments: AssignmentRow[],
  subs: SubmissionRow[],
  policy: ScoringPolicy,
  xpByStudent: Map<string, number> = new Map(),
): GradebookRow[] {
  const items = toScoredItems(assignments)
  return students.map((student) => ({
    student,
    score: computeStudentScore(items, entriesFor(student.id, subs), policy, xpByStudent.get(student.id) ?? 0),
  }))
}

export const fullName = (s: Pick<StudentRow, 'prefix' | 'first_name' | 'last_name'>) =>
  `${s.prefix}${s.first_name} ${s.last_name}`.trim()

// ตารางสำหรับส่งออก Excel (array of arrays) — แยกออกมาเพื่อทดสอบได้
export function buildExportSheets(
  rows: GradebookRow[],
  assignments: AssignmentRow[],
  subs: SubmissionRow[],
  meta: { classroom: string; term: number; year: number; school: string },
): { pp5: (string | number)[][]; detail: (string | number | null)[][] } {
  const title = `${meta.school} ภาคเรียนที่ ${meta.term}/${meta.year} ห้อง ${meta.classroom} วิชาเทคโนโลยี (การออกแบบและเทคโนโลยี)`
  const pp5: (string | number)[][] = [
    [title],
    ['เลขที่', 'เลขประจำตัว', 'ชื่อ - สกุล', 'คะแนนระหว่างภาค (80)', 'คะแนนปลายภาค (20)', 'รวม (100)', 'ผลการเรียน'],
  ]
  for (const r of rows) {
    const { during, final } = splitForPp5(r.score)
    pp5.push([r.student.number ?? '', r.student.student_code, fullName(r.student), during, final, r.score.total, formatGrade(r.score.grade)])
  }

  const subMap = new Map(subs.map((s) => [`${s.student_id}:${s.assignment_id}`, s]))
  const catHeaders = rows[0]?.score.categories.map((c) => `${CATEGORY_LABELS[c.category]} (${c.weight})`) ?? []
  const detail: (string | number | null)[][] = [
    [title],
    [
      'เลขที่',
      'เลขประจำตัว',
      'ชื่อ - สกุล',
      ...assignments.map((a) => `${a.session_no ? `คาบ ${a.session_no} ` : ''}${a.title} (${Number(a.max_score)})`),
      ...catHeaders,
      'รวม',
      'เกรด',
    ],
  ]
  for (const r of rows) {
    detail.push([
      r.student.number ?? '',
      r.student.student_code,
      fullName(r.student),
      ...assignments.map((a) => {
        const s = subMap.get(`${r.student.id}:${a.id}`)
        return s?.status === 'graded' && s.score != null ? Number(s.score) : null
      }),
      ...r.score.categories.map((c) => c.scaled),
      r.score.total,
      formatGrade(r.score.grade),
    ])
  }
  return { pp5, detail }
}
