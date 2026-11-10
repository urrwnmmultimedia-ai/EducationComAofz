import { describe, expect, it } from 'vitest'
import { composeGuess, courseProgressPercent, DEFAULT_STEPS, formatGuide, parseGuide, parseSteps, progressPercent, totalMinutes, warmupQuestions } from './sessionSteps'

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

describe('ช่องไกด์คำตอบขั้นเปิดคาบ', () => {
  const step = parseSteps([
    { key: 'warmup', label: 'อุ่นเครื่อง', minutes: 10, items: ['ข้อหนึ่ง?', 'ข้อสอง?'], guide: [[{ label: 'ทำได้', hint: 'เช่น โทร' }, { label: 'ทำไม่ได้' }]] },
  ])[0]!
  it('คำถามที่ไม่มีไกด์ได้ช่องเดียว', () => {
    const qs = warmupQuestions(step)
    expect(qs.map((q) => q.slots.length)).toEqual([2, 1])
  })
  it('รวมคำตอบเป็นข้อความสรุป', () => {
    const qs = warmupQuestions(step)
    expect(composeGuess(qs, [['โทร', ''], ['เพราะเน็ตเร็ว']])).toBe('1. ข้อหนึ่ง?\n   ทำได้: โทร\n2. ข้อสอง?\n   เพราะเน็ตเร็ว')
  })
  it('ไกด์เสียไม่ทำให้ขั้นตอนทั้งคาบเป็นค่าเริ่มต้น', () => {
    const [s] = parseSteps([{ key: 'warmup', label: 'เปิดคาบ', minutes: 5, guide: 'พัง' }])
    expect(s?.label).toBe('เปิดคาบ')
    expect(s?.guide).toBeUndefined()
  })
  it('แปลงข้อความในฟอร์มครูไป-กลับ', () => {
    const g = parseGuide('ทำได้ | เช่น โทร\nทำไม่ได้\n---\nเพราะ')
    expect(g).toEqual([[{ label: 'ทำได้', hint: 'เช่น โทร' }, { label: 'ทำไม่ได้' }], [{ label: 'เพราะ' }]])
    expect(formatGuide(g)).toBe('ทำได้ | เช่น โทร\nทำไม่ได้\n---\nเพราะ')
    expect(parseGuide('  \n')).toBeUndefined()
  })
})
