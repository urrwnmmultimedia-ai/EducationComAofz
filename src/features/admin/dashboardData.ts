import type { ExamAttemptRow, QuestionRow } from '@/lib/database.types'
import type { GradebookRow } from '@/features/assignments/gradebookData'

export interface ClassroomAverage {
  classroom: string
  average: number // คะแนนรวมเฉลี่ย (0–100)
  students: number
}

export function averageByClassroom(rows: GradebookRow[], roomName: Map<string, string>): ClassroomAverage[] {
  const groups = new Map<string, number[]>()
  for (const r of rows) {
    const id = r.student.classroom_id
    if (!id) continue
    groups.set(id, [...(groups.get(id) ?? []), r.score.total])
  }
  return [...groups.entries()]
    .map(([id, totals]) => ({
      classroom: roomName.get(id) ?? '-',
      average: Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10,
      students: totals.length,
    }))
    .sort((a, b) => a.classroom.localeCompare(b.classroom, 'th'))
}

export interface MissedQuestion {
  question: QuestionRow
  answered: number
  correctRate: number // 0–1
}

// ข้อที่ตอบผิดมากที่สุด จากทุกการสอบที่ส่งแล้ว (ต้องมีคนตอบอย่างน้อย minAnswered คน)
export function mostMissed(attempts: ExamAttemptRow[], questions: QuestionRow[], limit = 5, minAnswered = 3): MissedQuestion[] {
  const sum = new Map<string, { n: number; pts: number }>()
  for (const a of attempts) {
    if (!a.submitted_at) continue
    const points = (a.points ?? {}) as Record<string, unknown>
    for (const [qid, v] of Object.entries(points)) {
      if (typeof v !== 'number') continue
      const s = sum.get(qid) ?? { n: 0, pts: 0 }
      s.n += 1
      s.pts += v
      sum.set(qid, s)
    }
  }
  const byId = new Map(questions.map((q) => [q.id, q]))
  return [...sum.entries()]
    .filter(([id, s]) => s.n >= minAnswered && byId.has(id))
    .map(([id, s]) => ({ question: byId.get(id) as QuestionRow, answered: s.n, correctRate: Math.round((s.pts / s.n) * 100) / 100 }))
    .sort((a, b) => a.correctRate - b.correctRate || b.answered - a.answered)
    .slice(0, limit)
}
