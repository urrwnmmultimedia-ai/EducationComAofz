import { describe, expect, it } from 'vitest'
import { analyzeItems, type AttemptScores } from './itemAnalysis'

const att = (total: number, q1: number | null, q2: number | null): AttemptScores => ({ total, points: { q1, q2 } })

describe('analyzeItems', () => {
  // 10 คน: คนเก่ง (คะแนนสูง) ตอบ q1 ถูก คนอ่อนตอบผิด; q2 ทุกคนถูก
  const attempts = [
    att(10, 1, 1),
    att(9, 1, 1),
    att(8, 1, 1),
    att(7, 1, 1),
    att(6, 1, 1),
    att(5, 0, 1),
    att(4, 0, 1),
    att(3, 0, 1),
    att(2, 0, 1),
    att(1, 0, 1),
  ]
  const [s1, s2] = analyzeItems(['q1', 'q2'], attempts)

  it('ค่าความยาก p', () => {
    expect(s1?.p).toBe(0.5)
    expect(s1?.level).toBe('พอดี')
    expect(s2?.p).toBe(1)
    expect(s2?.level).toBe('ง่ายมาก')
  })

  it('อำนาจจำแนก r', () => {
    expect(s1?.r).toBe(1)
    expect(s1?.discrimination).toBe('ดี')
    expect(s2?.r).toBe(0)
    expect(s2?.discrimination).toBe('ควรปรับปรุง')
  })

  it('ข้อที่รอตรวจไม่นับ และคนน้อยเกินไปไม่คำนวณ r', () => {
    const [s] = analyzeItems(['q1'], [att(3, null, 1), att(2, 1, 1), att(1, 0, 1)])
    expect(s?.n).toBe(2)
    expect(s?.p).toBe(0.5)
    expect(s?.r).toBeNull()
  })

  it('ไม่มีคนสอบ', () => {
    expect(analyzeItems(['q1'], [])[0]).toMatchObject({ p: null, r: null, level: '–' })
  })
})
