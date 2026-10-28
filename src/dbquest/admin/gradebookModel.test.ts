import { describe, expect, it } from 'vitest'
import type { Gradebook, Scores } from './dbqAdminApi'
import { buildGradebookSheet, gradeOf, manualMax, parseScoreInput, weightsTotal } from './gradebookModel'

const empty = { weight: 0, earned: null, max: null, pct: null, points: null }
const scores = (total: number): Scores => ({
  categories: {
    worksheet: { weight: 25, earned: 4, max: 10, pct: 40, points: 10 },
    unit_quiz: { ...empty, weight: 15 },
    game: { weight: 10, earned: 100, max: 200, pct: 50, points: 5 },
    project: { ...empty, weight: 15 },
    attendance: { ...empty, weight: 5 },
    midterm: { weight: 10, earned: 15, max: 20, pct: 75, points: 7.5 },
    final: { ...empty, weight: 20 },
  },
  total,
  available: 45,
  current_pct: 50,
})

const gb: Gradebook = {
  weights: { worksheet: 25, unit_quiz: 15, game: 10, project: 15, attendance: 5, midterm: 10, final: 20 },
  assignments: [
    { id: 'a1', item_id: 'ws-s01', title: 'ใบงานที่ 1', max_score: 5, session_no: 1 },
    { id: 'a2', item_id: 'ws-s02', title: 'ใบงานที่ 2', max_score: 5, session_no: 2 },
  ],
  manual_max: { midterm: 20 },
  rows: [
    {
      id: 's1',
      student_code: '55555',
      number: 1,
      name: 'นายทดลอง ม.ห้า',
      nickname: 'ห้า',
      classroom_id: 'r1',
      classroom_name: 'ม.5/1',
      is_active: true,
      work: { a1: { status: 'graded', score: 4, submission_id: 'x' }, a2: { status: 'submitted', score: null, submission_id: 'y' } },
      manual: { midterm: { score: 15, max: 20 } },
      xp: 120,
      scores: scores(22.5),
    },
  ],
}

describe('สมุดคะแนน DB Quest', () => {
  it('เกรดตามเกณฑ์ไทย', () => {
    expect(gradeOf(scores(22.5))).toBe('0')
    expect(gradeOf(scores(77))).toBe('3.5')
    expect(gradeOf(scores(80))).toBe('4')
  })

  it('ช่องกรอกคะแนน', () => {
    expect(parseScoreInput('', 20)).toEqual({ ok: true, value: null })
    expect(parseScoreInput(' 15.5 ', 20)).toEqual({ ok: true, value: 15.5 })
    expect(parseScoreInput('21', 20)).toEqual({ ok: false })
    expect(parseScoreInput('-1', 20)).toEqual({ ok: false })
    expect(parseScoreInput('abc', 20)).toEqual({ ok: false })
  })

  it('น้ำหนักรวม / คะแนนเต็มที่ครูกรอก', () => {
    expect(weightsTotal(gb.weights)).toBe(100)
    expect(manualMax(gb, 'midterm')).toBe(20)
    expect(manualMax(gb, 'final')).toBe(100)
  })

  it('ไฟล์ Excel: หัวตาราง + สถานะงาน + คะแนนรวม', () => {
    const [header, row] = buildGradebookSheet(gb)
    expect(header).toContain('ใบงานที่ 1 (5)')
    expect(header).toContain('สอบปลายภาค (20)')
    expect(row).toEqual(['ม.5/1', 1, '55555', 'นายทดลอง ม.ห้า', 'ห้า', 4, 'รอตรวจ', 10, '', 5, '', '', 7.5, '', 22.5, '0', 120])
  })
})
