import { describe, expect, it } from 'vitest'
import type { ExamAttemptRow, QuestionRow } from '@/lib/database.types'
import type { GradebookRow } from '@/features/assignments/gradebookData'
import { averageByClassroom, mostMissed } from './dashboardData'

const row = (room: string | null, total: number) => ({ student: { classroom_id: room }, score: { total } }) as unknown as GradebookRow
const q = (id: string) => ({ id, prompt: id }) as QuestionRow
const att = (points: Record<string, number | null>, submitted = true) => ({ points, submitted_at: submitted ? 'x' : null }) as unknown as ExamAttemptRow

describe('averageByClassroom', () => {
  it('เฉลี่ยรายห้อง ข้ามนักเรียนไม่มีห้อง', () => {
    const r = averageByClassroom([row('a', 60), row('a', 71), row('b', 90), row(null, 10)], new Map([['a', 'ม.3/1'], ['b', 'ม.3/2']]))
    expect(r).toEqual([
      { classroom: 'ม.3/1', average: 65.5, students: 2 },
      { classroom: 'ม.3/2', average: 90, students: 1 },
    ])
  })
})

describe('mostMissed', () => {
  it('เรียงจากอัตราถูกน้อยสุด ข้ามข้อที่คนตอบน้อยและรอตรวจ', () => {
    const attempts = [att({ q1: 0, q2: 1, q3: null }), att({ q1: 0, q2: 1 }), att({ q1: 1, q2: 0 }), att({ q1: 0 }, false), att({ q4: 0 })]
    const r = mostMissed(attempts, [q('q1'), q('q2'), q('q3'), q('q4')], 5, 3)
    expect(r.map((m) => [m.question.id, m.correctRate])).toEqual([
      ['q1', 0.33],
      ['q2', 0.67],
    ])
  })
})
