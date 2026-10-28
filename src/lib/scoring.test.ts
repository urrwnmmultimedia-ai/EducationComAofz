import { describe, expect, it } from 'vitest'
import {
  computeStudentScore,
  DEFAULT_WEIGHTS,
  effectiveScore,
  isLate,
  parseWeights,
  splitForPp5,
  weightsTotal,
  type ScoreEntry,
  type ScoredItem,
  type ScoringPolicy,
} from './scoring'
import { DEFAULT_GRADE_SCALE } from './grade'

const policy: ScoringPolicy = {
  weights: DEFAULT_WEIGHTS,
  gradeScale: [...DEFAULT_GRADE_SCALE],
  latePenaltyEnabled: true,
  latePenaltyPct: 20,
  affectiveFullXp: 1000,
}

const item = (id: string, category: ScoredItem['category'], maxScore: number, dueAt: string | null = null): ScoredItem => ({
  id,
  category,
  maxScore,
  dueAt,
})

const entries = (pairs: [string, number | null, string?][]) =>
  new Map<string, ScoreEntry>(pairs.map(([id, score, submittedAt]) => [id, { score, submittedAt: submittedAt ?? null }]))

describe('late penalty', () => {
  const it1 = item('a', 'work', 10, '2026-11-01T00:00:00Z')
  it('ส่งตรงเวลาไม่หัก', () => {
    expect(effectiveScore(it1, { score: 10, submittedAt: '2026-10-31T00:00:00Z' }, policy)).toBe(10)
  })
  it('ส่งช้าหัก 20%', () => {
    expect(isLate(it1, { submittedAt: '2026-11-02T00:00:00Z' })).toBe(true)
    expect(effectiveScore(it1, { score: 10, submittedAt: '2026-11-02T00:00:00Z' }, policy)).toBe(8)
  })
  it('ปิดการหักได้', () => {
    expect(effectiveScore(it1, { score: 10, submittedAt: '2026-11-02T00:00:00Z' }, { ...policy, latePenaltyEnabled: false })).toBe(10)
  })
  it('ครูกรอกคะแนนโดยไม่มีวันส่ง ไม่ถือว่าช้า', () => {
    expect(effectiveScore(it1, { score: 7, submittedAt: null }, policy)).toBe(7)
  })
  it('คะแนนเกินเต็มถูกตัด', () => {
    expect(effectiveScore(it1, { score: 15, submittedAt: null }, policy)).toBe(10)
  })
})

describe('computeStudentScore', () => {
  const items = [
    item('w1', 'work', 3),
    item('w2', 'work', 3),
    item('p1', 'project', 15),
    item('u1', 'unit_test', 5),
    item('u2', 'unit_test', 5),
    item('u3', 'unit_test', 5),
    item('m', 'midterm', 20),
    item('f', 'final', 20),
  ]

  it('คะแนนเต็มทุกช่องได้ 100 เกรด 4', () => {
    const e = entries(items.map((i) => [i.id, i.maxScore]))
    const s = computeStudentScore(items, e, policy)
    expect(s.total).toBe(100)
    expect(s.grade).toBe(4)
  })

  it('แปลงงานเป็นสเกล 30 อัตโนมัติ (งานเต็ม 6 ได้ 3 = 15/30)', () => {
    const s = computeStudentScore(items, entries([['w1', 3]]), policy)
    expect(s.categories.find((c) => c.category === 'work')?.scaled).toBe(15)
    expect(s.total).toBe(15)
  })

  it('คาดการณ์จากรายการที่ตรวจแล้ว', () => {
    const s = computeStudentScore(items, entries([['w1', 3], ['m', 10]]), policy)
    // work 100% (น้ำหนัก 30), midterm 50% (น้ำหนัก 20) => (30 + 10) / 50 * 100 = 80
    expect(s.predictedTotal).toBe(80)
    expect(s.predictedGrade).toBe(4)
  })

  it('ยังไม่มีคะแนนเลย คาดการณ์เป็น null', () => {
    const s = computeStudentScore(items, new Map(), policy)
    expect(s.total).toBe(0)
    expect(s.predictedTotal).toBeNull()
  })

  it('หมวดที่ไม่มีรายการได้ 0 ไม่ error', () => {
    const s = computeStudentScore([item('w1', 'work', 3)], entries([['w1', 3]]), policy)
    expect(s.total).toBe(30)
  })

  it('จิตพิสัยจาก XP', () => {
    const p = { ...policy, weights: { ...DEFAULT_WEIGHTS, work: 25, affective: 5 } }
    const s = computeStudentScore(items, new Map(), p, 500)
    expect(s.categories.find((c) => c.category === 'affective')?.scaled).toBe(2.5)
    expect(s.total).toBe(2.5)
  })

  it('แยกคะแนน ปพ.5', () => {
    const e = entries(items.map((i) => [i.id, i.maxScore]))
    expect(splitForPp5(computeStudentScore(items, e, policy))).toEqual({ during: 80, final: 20 })
  })
})

describe('weights', () => {
  it('ค่าเริ่มต้นรวม 100', () => {
    expect(weightsTotal(DEFAULT_WEIGHTS)).toBe(100)
  })
  it('ข้อมูลเสียใช้ค่าเริ่มต้น', () => {
    expect(parseWeights({ work: 'x' })).toEqual(DEFAULT_WEIGHTS)
  })
  it('affective ไม่ระบุ = 0', () => {
    expect(parseWeights({ work: 30, project: 15, unit_test: 15, midterm: 20, final: 20 }).affective).toBe(0)
  })
})
