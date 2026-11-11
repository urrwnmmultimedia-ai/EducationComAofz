import { describe, expect, it } from 'vitest'
import {
  computeSoFarScore,
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

// ตั้งค่าแบบเดิม (ยังไม่มีเกม) — งาน 30
const NO_GAME = { ...DEFAULT_WEIGHTS, work: 30, game: 0 }

const policy: ScoringPolicy = {
  weights: NO_GAME,
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

  it('แต่ละคาบได้ส่วนแบ่งเท่ากัน ไม่ว่าคาบนั้นคะแนนเต็มเท่าไร', () => {
    const work = [
      { ...item('a', 'work', 10), sessionNo: 1 },
      { ...item('b', 'work', 2), sessionNo: 2 },
      { ...item('c', 'work', 2), sessionNo: 2 },
      { ...item('d', 'work', 3), sessionNo: 3 },
      { ...item('z', 'work', 0), sessionNo: 4 }, // ไม่มีคะแนน ไม่นับเป็นคาบ
    ]
    // ทำคาบ 1 (เต็ม 10) ครบ = 1 ใน 3 คาบ = 10/30 (เดิมได้ 10/17 ของ 30)
    const s = computeStudentScore(work, entries([['a', 10]]), policy)
    const w = s.categories.find((c) => c.category === 'work')
    expect(w?.slots).toBe(3)
    expect(w?.scaled).toBe(10)
    // คาบ 2 ได้ครึ่งเดียว (2 จาก 4) = 0.5 คาบ
    expect(computeStudentScore(work, entries([['b', 2]]), policy).total).toBe(5)
  })

  it('จิตพิสัยจาก XP', () => {
    const p = { ...policy, weights: { ...NO_GAME, work: 25, affective: 5 } }
    const s = computeStudentScore(items, new Map(), p, 500)
    expect(s.categories.find((c) => c.category === 'affective')?.scaled).toBe(2.5)
    expect(s.total).toBe(2.5)
  })

  it('แยกคะแนน ปพ.5', () => {
    const e = entries(items.map((i) => [i.id, i.maxScore]))
    expect(splitForPp5(computeStudentScore(items, e, policy))).toEqual({ during: 80, final: 20 })
  })
})

describe('computeSoFarScore (วิวัฒนาการ: เฉพาะคาบที่เปิดแล้ว)', () => {
  const s = (id: string, cat: ScoredItem['category'], max: number, sessionNo: number): ScoredItem => ({ ...item(id, cat, max), sessionNo })
  const items = [s('w1', 'work', 4, 1), s('w2', 'work', 4, 2), s('w3', 'work', 4, 3), s('m', 'midterm', 20, 10)]

  it('ทำเต็มทุกคาบที่เปิด = 100 แม้คาบอื่นยังไม่เปิด', () => {
    expect(computeSoFarScore(items, entries([['w1', 4], ['w2', 4]]), policy, new Set([1, 2]))).toBe(100)
  })

  it('ยังไม่ส่งในคาบที่เปิด = 0 · รอตรวจไม่นับ', () => {
    const e = new Map<string, ScoreEntry>([
      ['w1', { score: 4, submittedAt: null }],
      ['w2', { score: null, submittedAt: '2026-11-01T00:00:00Z' }], // รอตรวจ
    ])
    expect(computeSoFarScore(items, e, policy, new Set([1, 2]))).toBe(100)
    expect(computeSoFarScore(items, e, policy, new Set([1, 2, 3]))).toBe(50) // คาบ 3 ไม่ส่ง
  })

  it('เฉลี่ยตามน้ำหนักเฉพาะหมวดที่มีคาบให้นับ', () => {
    // work 100% (30) + midterm 50% (20) → (30 + 10) / 50 = 80
    expect(computeSoFarScore(items, entries([['w1', 4], ['m', 10]]), policy, new Set([1, 10]))).toBe(80)
  })

  it('ยังไม่มีคาบเปิด = 0', () => {
    expect(computeSoFarScore(items, new Map(), policy, new Set())).toBe(0)
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

describe('หมวดเกมประจำคาบ (ม.3)', () => {
  const withGame: ScoringPolicy = { ...policy, latePenaltyEnabled: false, weights: { ...DEFAULT_WEIGHTS } }
  const game = (n: number, max = 100): ScoredItem => ({ id: `game:s${n}`, category: 'game', maxScore: max, dueAt: null, sessionNo: n })

  it('ค่าเริ่มต้น: งาน 20 + เกม 10 รวม 100', () => {
    expect(DEFAULT_WEIGHTS.game).toBe(10)
    expect(weightsTotal(DEFAULT_WEIGHTS)).toBe(100)
  })

  it('เกมแต่ละคาบได้ส่วนเท่ากัน ยังไม่เล่น = 0', () => {
    // 2 คาบมีเกม: คาบ 1 ได้ 80/100 · คาบ 2 ยังไม่เล่น → (0.8 + 0) / 2 × 10 = 4
    const r = computeStudentScore([game(1), game(2)], new Map([['game:s1', { score: 80, submittedAt: null }]]), withGame)
    expect(r.categories.find((c) => c.category === 'game')?.scaled).toBe(4)
    expect(r.total).toBe(4)
  })

  it('คะแนนเกมเกินเต็มถูกตัดที่เต็ม', () => {
    const r = computeStudentScore([game(1, 50)], new Map([['game:s1', { score: 70, submittedAt: null }]]), withGame)
    expect(r.categories.find((c) => c.category === 'game')?.scaled).toBe(10)
  })

  it('ตั้งค่าเก่าที่ไม่มีเกม: ไม่มีช่องเกมและไม่ดึงคะแนน', () => {
    expect(parseWeights({ work: 30, project: 15, unit_test: 15, midterm: 20, final: 20 }).game).toBe(0)
    const r = computeStudentScore([game(1)], new Map(), { ...withGame, weights: NO_GAME })
    expect(r.categories.some((c) => c.category === 'game')).toBe(false)
  })
})
