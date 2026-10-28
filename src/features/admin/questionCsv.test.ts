import { describe, expect, it } from 'vitest'
import type { QuestionRow } from '@/lib/database.types'
import { CSV_HEADER, decodeAnswerFields, encodeAnswerFields, parseQuestionTable, questionToCsvRow, shuffleIndices } from './questionCsv'

const fixedRandom = () => 0.3

describe('encode/decode', () => {
  it('ปรนัย', () => {
    const e = encodeAnswerFields('mcq', 'ก;ข;ค;ง', '3')
    expect(e).toEqual({ choices: ['ก', 'ข', 'ค', 'ง'], correct_answer: { index: 2 } })
    expect(decodeAnswerFields({ type: 'mcq', ...e })).toEqual({ choices: 'ก;ข;ค;ง', answer: '3' })
  })
  it('ถูก/ผิด', () => {
    expect(encodeAnswerFields('true_false', '', 'ผิด').correct_answer).toEqual({ value: false })
    expect(() => encodeAnswerFields('true_false', '', 'อาจจะ')).toThrow()
  })
  it('จับคู่: ฝั่งขวาถูกสลับ แต่แปลงกลับได้ตรง', () => {
    const e = encodeAnswerFields('matching', 'A=1;B=2;C=3', '', fixedRandom)
    const m = e.choices as { left: string[]; right: string[] }
    expect(m.left).toEqual(['A', 'B', 'C'])
    expect(m.right).not.toEqual(['1', '2', '3'])
    expect(decodeAnswerFields({ type: 'matching', ...e }).choices).toBe('A=1;B=2;C=3')
  })
  it('เรียงลำดับ: เก็บแบบสลับ แต่แปลงกลับได้ลำดับถูก', () => {
    const e = encodeAnswerFields('ordering', 'หนึ่ง;สอง;สาม;สี่', '', fixedRandom)
    expect(e.choices).not.toEqual(['หนึ่ง', 'สอง', 'สาม', 'สี่'])
    expect(decodeAnswerFields({ type: 'ordering', ...e }).choices).toBe('หนึ่ง;สอง;สาม;สี่')
  })
  it('เติมคำต้องมีคำตอบ', () => {
    expect(() => encodeAnswerFields('fill', '', '')).toThrow()
  })
})

describe('shuffleIndices', () => {
  it('ไม่คืนลำดับเดิม', () => {
    expect(shuffleIndices(3, () => 0.999)).not.toEqual([0, 1, 2])
  })
})

describe('parseQuestionTable', () => {
  it('อ่านไฟล์ พร้อมรายงานแถวผิด', () => {
    const r = parseQuestionTable([
      CSV_HEADER,
      ['', '1', '1.1', '1', 'ปรนัย', 'ง่าย', 'คำถาม 1', 'a;b;c;d', '2', 'เพราะ', 'ใช่'],
      ['', '', '', '', 'unknown', '', 'x', '', '', '', ''],
      ['', '', '', '', 'mcq', '', 'คำถาม 3', 'a;b', '5', '', ''],
      [],
    ])
    expect(r.drafts).toHaveLength(1)
    expect(r.drafts[0]).toMatchObject({ unitNo: 1, type: 'mcq', difficulty: 'easy', reviewed: true, correct_answer: { index: 1 } })
    expect(r.issues.map((i) => i.line)).toEqual([3, 4])
  })
  it('ส่งออกแล้วนำเข้ากลับได้ข้อมูลเดิม', () => {
    const q: QuestionRow = {
      id: '11111111-1111-4111-a111-111111111111',
      unit_id: 'u1',
      topic: '1.2',
      indicator: 1,
      type: 'fill',
      prompt: 'หน่วยแบตเตอรี่',
      choices: [],
      correct_answer: { accept: ['kWh', 'กิโลวัตต์-ชั่วโมง'] },
      explanation: 'อธิบาย',
      difficulty: 'hard',
      reviewed: false,
      created_at: '',
    }
    const row = questionToCsvRow(q, new Map([['u1', 1]]))
    const [d] = parseQuestionTable([CSV_HEADER, row]).drafts
    expect(d).toMatchObject({ id: q.id, unitNo: 1, topic: '1.2', type: 'fill', correct_answer: q.correct_answer, difficulty: 'hard', reviewed: false })
  })
})
