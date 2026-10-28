import { describe, expect, it } from 'vitest'
import { computeGrade, formatGrade } from './grade'

describe('computeGrade', () => {
  it.each([
    [100, 4],
    [80, 4],
    [79.99, 3.5],
    [75, 3.5],
    [70, 3],
    [65, 2.5],
    [60, 2],
    [55, 1.5],
    [50, 1],
    [49.5, 0],
    [0, 0],
  ])('คะแนน %d ได้เกรด %d', (score, grade) => {
    expect(computeGrade(score)).toBe(grade)
  })

  it('ใช้เกณฑ์ที่ครูกำหนดได้ แม้ไม่ได้เรียงลำดับ', () => {
    const scale = [
      { min: 0, grade: 0 },
      { min: 90, grade: 4 },
      { min: 50, grade: 1 },
    ]
    expect(computeGrade(85, scale)).toBe(1)
    expect(computeGrade(90, scale)).toBe(4)
  })

  it('ค่าไม่ใช่ตัวเลขได้ 0', () => {
    expect(computeGrade(Number.NaN)).toBe(0)
  })
})

describe('formatGrade', () => {
  it('แสดงทศนิยมเฉพาะเกรดครึ่ง', () => {
    expect(formatGrade(4)).toBe('4')
    expect(formatGrade(3.5)).toBe('3.5')
  })
})
