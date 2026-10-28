import { describe, expect, it } from 'vitest'
import { examErrorText, formatClock, isAnswered, moveItem, remainingMs, seededOrder, startResponseSchema, type Answer, type ExamQuestion } from './examModel'

const q = (type: ExamQuestion['type'], choices: ExamQuestion['choices'] = []): ExamQuestion => ({ id: '1', type, prompt: 'x', choices })

describe('isAnswered', () => {
  it.each([
    [q('mcq', ['a', 'b']), { index: 0 }, true],
    [q('mcq', ['a', 'b']), null, false],
    [q('true_false'), { value: false }, true],
    [q('matching', { left: ['a', 'b'], right: ['x', 'y'] }), { pairs: [1, null] }, false],
    [q('matching', { left: ['a', 'b'], right: ['x', 'y'] }), { pairs: [1, 0] }, true],
    [q('fill'), { text: '  ' }, false],
    [q('short'), { text: 'ok' }, true],
  ] as [ExamQuestion, Answer | null, boolean][])('%#', (question, answer, expected) => {
    expect(isAnswered(question, answer)).toBe(expected)
  })
})

describe('seededOrder', () => {
  it('ลำดับเดิมเมื่อ seed เดิม และเป็นการเรียงสับเปลี่ยน', () => {
    const a = seededOrder(6, 'attempt-1:q1')
    expect(seededOrder(6, 'attempt-1:q1')).toEqual(a)
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('seed ต่างกันได้ลำดับต่างกัน (อย่างน้อยหนึ่งคู่)', () => {
    const results = new Set(['a', 'b', 'c', 'd', 'e'].map((s) => seededOrder(5, s).join()))
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('moveItem', () => {
  it('ย้ายตำแหน่ง', () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
  })
  it('ย้ายออกนอกขอบไม่เปลี่ยน', () => {
    const list = [1, 2]
    expect(moveItem(list, 0, -1)).toBe(list)
  })
})

describe('timer', () => {
  it('ชดเชยนาฬิกาเครื่องที่ช้ากว่าเซิร์ฟเวอร์', () => {
    // เซิร์ฟเวอร์ 10:00:00 แต่เครื่องนักเรียนบอก 09:59:00 (ช้า 60 วินาที)
    const server = '2026-11-01T10:00:00Z'
    const client = new Date('2026-11-01T09:59:00Z').getTime()
    const left = remainingMs('2026-11-01T10:10:00Z', server, client, client + 30_000)
    expect(left).toBe(9.5 * 60_000)
  })
  it('ไม่มีกำหนดเวลา = null และไม่ติดลบ', () => {
    expect(remainingMs(null, '2026-11-01T10:00:00Z', 0, 0)).toBeNull()
    expect(remainingMs('2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z', 0, 0)).toBe(0)
  })
  it('formatClock', () => {
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(400)).toBe('0:01')
  })
})

describe('startResponseSchema', () => {
  it('อ่านผลกรณีทำครบแล้ว', () => {
    const p = startResponseSchema.parse({
      finished: true,
      result: { attempt_id: 'a', attempt_no: 1, score: '4', max_points: '5', needs_review: false, submitted_at: null, show_answers: false, review: null },
    })
    expect('finished' in p && p.result?.score).toBe(4)
  })
})

it('ข้อความ error ภาษาไทย', () => {
  expect(examErrorText('exam_locked')).toContain('ยังไม่เปิด')
  expect(examErrorText('weird')).toContain('ลองใหม่')
})
