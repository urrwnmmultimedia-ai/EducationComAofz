import { describe, expect, it } from 'vitest'
import { canFlip, flip, hide, isComplete, matchScore, newGame, type MatchState, type Pair } from './memoryMatch'

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

  it('คะแนน', () => {
    let s = fresh()
    expect(matchScore(s)).toBe(0)
    s = flip(flip(s, 0), 1)
    expect(matchScore(s)).toBe(30) // หมดเวลา จับได้ 1 ใน 2 คู่
    s = flip(flip(s, 2), 3)
    expect(isComplete(s)).toBe(true)
    expect(matchScore(s)).toBe(100)
    expect(matchScore({ ...s, misses: 2 })).toBe(100)
    expect(matchScore({ ...s, misses: 5 })).toBe(88)
    expect(matchScore({ ...s, misses: 50 })).toBe(40)
  })
})
