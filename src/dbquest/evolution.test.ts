import { describe, expect, it } from 'vitest'
import { EVO_STAGES, evolutionOf } from './evolution'

describe('วิวัฒนาการ DB Quest', () => {
  it('เริ่มที่เจ้าทุยน้อย', () => {
    const e = evolutionOf(0, 0)
    expect(e.index).toBe(0)
    expect(e.stage.name).toBe('เจ้าทุยน้อย')
    expect(e.xpToNext).toBe(100)
    expect(e.sessionsToNext).toBe(1)
  })

  it('ต้องผ่านทั้ง XP และจำนวนคาบ', () => {
    expect(evolutionOf(5000, 0).index).toBe(0) // XP เยอะแต่ยังไม่เรียนจบคาบไหน
    expect(evolutionOf(0, 20).index).toBe(0) // เรียนครบแต่ไม่มี XP (ทฤษฎี)
    expect(evolutionOf(100, 1).index).toBe(1)
    expect(evolutionOf(420, 3).index).toBe(2)
    expect(evolutionOf(420, 2).index).toBe(1)
  })

  it('ความคืบหน้าไปขั้นถัดไป', () => {
    const e = evolutionOf(250, 2) // ขั้น 1 (100/1) → ขั้น 2 (400/3)
    expect(e.index).toBe(1)
    expect(e.xpToNext).toBe(150)
    expect(e.sessionsToNext).toBe(1)
    expect(e.xpProgress).toBeCloseTo(0.5)
    expect(e.sessionProgress).toBeCloseTo(0.5)
  })

  it('ขั้นสุดท้าย', () => {
    const e = evolutionOf(9999, 17)
    expect(e.index).toBe(EVO_STAGES.length - 1)
    expect(e.next).toBeNull()
    expect(e.xpProgress).toBe(1)
  })

  it('เกณฑ์เพิ่มขึ้นทุกขั้น', () => {
    for (let i = 1; i < EVO_STAGES.length; i++) {
      expect(EVO_STAGES[i]!.minXp).toBeGreaterThan(EVO_STAGES[i - 1]!.minXp)
      expect(EVO_STAGES[i]!.minSessions).toBeGreaterThan(EVO_STAGES[i - 1]!.minSessions)
    }
  })
})
