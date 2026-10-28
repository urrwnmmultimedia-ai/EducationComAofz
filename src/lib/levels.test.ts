import { describe, expect, it } from 'vitest'
import { levelFromXp } from './levels'

describe('levelFromXp', () => {
  it('เริ่มต้นเลเวล 1 นักสำรวจ', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, name: 'นักสำรวจ', xpInLevel: 0, xpToNext: 200, progress: 0 })
  })
  it('199 XP ยังเลเวล 1', () => {
    expect(levelFromXp(199).level).toBe(1)
  })
  it('200 XP ขึ้นเลเวล 2 นักคิด', () => {
    const info = levelFromXp(200)
    expect(info.level).toBe(2)
    expect(info.name).toBe('นักคิด')
  })
  it('เลเวลเกิน 6 ยังเป็นนวัตกร', () => {
    expect(levelFromXp(5000).name).toBe('นวัตกร')
    expect(levelFromXp(5000).level).toBe(26)
  })
  it('ค่าติดลบหรือไม่ใช่ตัวเลขนับเป็น 0', () => {
    expect(levelFromXp(-50).level).toBe(1)
    expect(levelFromXp(Number.NaN).xpInLevel).toBe(0)
  })
  it('progress เป็นสัดส่วนในเลเวล', () => {
    expect(levelFromXp(250).progress).toBe(0.25)
  })
})
