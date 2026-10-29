import { describe, expect, it } from 'vitest'
import { courseProgressPercent, DEFAULT_STEPS, parseSteps, progressPercent, totalMinutes } from './sessionSteps'

describe('parseSteps', () => {
  it('ค่าเริ่มต้นรวม 120 นาที', () => {
    expect(totalMinutes(DEFAULT_STEPS)).toBe(120)
  })
  it('ข้อมูลเสียใช้ค่าเริ่มต้น', () => {
    expect(parseSteps(null)).toBe(DEFAULT_STEPS)
    expect(parseSteps([{ key: 'nope' }])).toBe(DEFAULT_STEPS)
    expect(parseSteps([])).toBe(DEFAULT_STEPS)
  })
  it('อ่านข้อมูลถูกต้อง', () => {
    const steps = parseSteps([{ key: 'warmup', label: 'อุ่น', minutes: 10, items: ['ถาม'] }])
    expect(steps).toEqual([{ key: 'warmup', label: 'อุ่น', minutes: 10, items: ['ถาม'] }])
  })
})

describe('courseProgressPercent', () => {
  it('counts every session, including locked ones', () => {
    expect(
      courseProgressPercent([
        { completed_steps: ['a', 'b', 'c', 'd', 'e', 'f'], total_steps: 6 },
        { completed_steps: [], total_steps: 6 },
        { completed_steps: [], total_steps: 6 },
        { completed_steps: [], total_steps: 6 },
      ]),
    ).toBe(25)
    expect(courseProgressPercent([])).toBe(0)
  })
})

describe('progressPercent', () => {
  it('ไม่นับคาบที่ยังล็อก', () => {
    expect(
      progressPercent([
        { is_unlocked: true, completed_steps: ['warmup', 'content', 'game'], total_steps: 6 },
        { is_unlocked: false, completed_steps: [], total_steps: 6 },
      ]),
    ).toBe(50)
  })
  it('ไม่มีคาบเปิดได้ 0', () => {
    expect(progressPercent([])).toBe(0)
  })
})
