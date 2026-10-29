import { describe, expect, it } from 'vitest'
import { canFlip, flip, isComplete, hide, matchScore, newGame, starDeadlines, starsForScore, timeScore, type MatchState, type Pair } from './memoryMatch'

const pairs: Pair[] = [
  { id: 'a', term: 'A', meaning: 'a' },
  { id: 'b', term: 'B', meaning: 'b' },
]
// ไม่สลับ: [a:t, a:m, b:t, b:m]
const fresh = (): MatchState => newGame(pairs, () => 0.999)

describe('Memory Match', () => {
  it('สำรับมีไพ่ 2 ใบต่อคู่', () => {
    const s = newGame(pairs)
    expect(s.cards).toHaveLength(4)
    expect(new Set(s.cards.map((c) => c.key)).size).toBe(4)
  })

  it('เปิดตรงคู่ = จับคู่ได้', () => {
    let s = fresh()
    expect(s.cards.map((c) => c.key)).toEqual(['a:t', 'a:m', 'b:t', 'b:m'])
    s = flip(flip(s, 0), 1)
    expect(s.matched).toEqual(['a'])
    expect(s.open).toEqual([])
    expect(s.moves).toBe(1)
    expect(canFlip(s, 0)).toBe(false)
  })

  it('เปิดผิด = ค้างไว้จนกว่าจะคว่ำ', () => {
    let s = flip(flip(fresh(), 0), 2)
    expect(s.misses).toBe(1)
    expect(canFlip(s, 3)).toBe(false)
    expect(flip(s, 3)).toBe(s)
    s = hide(s)
    expect(s.open).toEqual([])
    expect(canFlip(s, 3)).toBe(true)
  })

  it('เปิดใบเดิมซ้ำไม่นับ', () => {
    const s = flip(fresh(), 0)
    expect(flip(s, 0)).toBe(s)
  })

  it('คะแนนจากเวลาเท่านั้น ไม่นับเปิดผิด', () => {
    let s = fresh()
    expect(matchScore(s, 30, 60)).toBe(0)
    s = flip(flip(s, 0), 1)
    expect(matchScore(s, 30, 60)).toBe(0) // ยังไม่ครบ
    s = flip(flip(s, 2), 3)
    expect(isComplete(s)).toBe(true)
    expect(matchScore(s, 30, 60)).toBe(100)
    expect(matchScore({ ...s, misses: 50 }, 30, 60)).toBe(100)
    expect(timeScore(60, 60)).toBe(100)
    expect(timeScore(120, 60)).toBe(70)
    expect(timeScore(180, 60)).toBe(40)
    expect(timeScore(9999, 60)).toBe(40)
  })

  it('เส้นตายของดาวตรงกับคะแนน', () => {
    const t = 180
    const d = starDeadlines(t)
    expect(starsForScore(timeScore(d.three, t))).toBe(3)
    expect(starsForScore(timeScore(d.three + 1, t))).toBe(2)
    expect(starsForScore(timeScore(d.two, t))).toBe(2)
    expect(starsForScore(timeScore(d.two + 1, t))).toBe(1)
  })
})
