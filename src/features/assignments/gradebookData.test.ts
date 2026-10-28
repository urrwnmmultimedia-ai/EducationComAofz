import { describe, expect, it } from 'vitest'
import type { AssignmentRow, StudentRow, SubmissionRow } from '@/lib/database.types'
import { DEFAULT_GRADE_SCALE } from '@/lib/grade'
import { DEFAULT_WEIGHTS } from '@/lib/scoring'
import { buildExportSheets, buildGradebook, entriesFor, sortAssignments } from './gradebookData'

const student = (id: string, number: number): StudentRow => ({
  id,
  student_code: `1000${number}`,
  prefix: 'เด็กชาย',
  first_name: `ชื่อ${number}`,
  last_name: 'สกุล',
  nickname: '',
  classroom_id: 'r1',
  number,
  avatar: 'non',
  is_active: true,
  bound_auth_uid: null,
  bound_device_key: null,
  created_at: '',
})

const assignment = (id: string, category: AssignmentRow['category'], max: number, session: number): AssignmentRow => ({
  id,
  session_no: session,
  unit_id: null,
  title: id,
  instructions_md: '',
  type: 'text',
  max_score: max,
  rubric: [],
  config: {},
  due_at: null,
  category,
  sort_order: 1,
  created_at: '',
})

const sub = (student_id: string, assignment_id: string, score: number | null, status: SubmissionRow['status']): SubmissionRow => ({
  id: `${student_id}-${assignment_id}`,
  assignment_id,
  student_id,
  content: {},
  file_paths: [],
  submitted_at: null,
  score,
  feedback: null,
  status,
  updated_at: '',
})

const policy = { weights: DEFAULT_WEIGHTS, gradeScale: [...DEFAULT_GRADE_SCALE], latePenaltyEnabled: false, latePenaltyPct: 0, affectiveFullXp: 1000 }

describe('gradebook', () => {
  const assignments = sortAssignments([assignment('final', 'final', 20, 20), assignment('w', 'work', 10, 2), assignment('mid', 'midterm', 20, 10)])

  it('เรียงตามหมวด', () => {
    expect(assignments.map((a) => a.id)).toEqual(['w', 'mid', 'final'])
  })

  it('งานที่ส่งคืนให้แก้ยังไม่นับคะแนน', () => {
    const e = entriesFor('s1', [sub('s1', 'w', 8, 'returned')])
    expect(e.get('w')?.score).toBeNull()
  })

  it('สร้างตาราง ปพ.5 และรายละเอียด', () => {
    const subs = [sub('s1', 'w', 10, 'graded'), sub('s1', 'mid', 20, 'graded'), sub('s1', 'final', 10, 'graded')]
    const rows = buildGradebook([student('s1', 1)], assignments, subs, policy)
    // work 30 (หมวดอื่นไม่มีรายการ = 0) + mid 20 + final 10 = 60
    expect(rows[0]?.score.total).toBe(60)
    const { pp5, detail } = buildExportSheets(rows, assignments, subs, { classroom: 'ม.3/1', term: 1, year: 2569, school: 'รร.' })
    expect(pp5[2]).toEqual([1, '10001', 'เด็กชายชื่อ1 สกุล', 50, 10, 60, '2'])
    expect(detail[1]?.slice(3, 6)).toEqual(['คาบ 2 w (10)', 'คาบ 10 mid (20)', 'คาบ 20 final (20)'])
    expect(detail[2]?.slice(3, 6)).toEqual([10, 20, 10])
  })
})
