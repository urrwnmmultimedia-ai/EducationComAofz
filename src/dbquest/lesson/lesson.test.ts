import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { sessionContentSchema, VISUAL_KINDS, type Question } from '@/content/lesson'
import { FIGURES } from './figures'
import { initialDraft, isDraftComplete, moveId, toggleChoice } from './questionDraft'

const unitsDir = fileURLToPath(new URL('../../content/units/', import.meta.url))
const keysDir = fileURLToPath(new URL('../../../supabase/answer_keys/', import.meta.url))
const sessions = readdirSync(unitsDir)
  .filter((f) => /^s\d{2}\.json$/.test(f))
  .map((f) => sessionContentSchema.parse(JSON.parse(readFileSync(unitsDir + f, 'utf8'))))
const keyFiles = readdirSync(keysDir).map((f) => JSON.parse(readFileSync(keysDir + f, 'utf8')) as {
  session: number
  items: { item_id: string; item_type: string; grade_type: string }[]
})

describe('เนื้อหาคาบ sNN.json', () => {
  for (const s of sessions) {
    const keys = keyFiles.find((k) => k.session === s.session)?.items ?? []
    const keyById = new Map(keys.map((k) => [k.item_id, k]))
    const questions: [Question, string][] = [
      ...s.cards.map((c) => [c.check, 'check'] as [Question, string]),
      ...s.practice.map((q) => [q, 'practice'] as [Question, string]),
      ...(s.closing?.questions ?? []).map((q) => [q, 'wrapup'] as [Question, string]),
    ]

    it(`คาบ ${s.session}: ทุกข้อมีเฉลยชนิดตรงกัน`, () => {
      for (const [q, type] of questions) {
        expect(keyById.get(q.id), q.id).toMatchObject({ item_type: type, grade_type: q.type })
      }
      if (s.worksheet) expect(keyById.get(s.worksheet.item_id)?.item_type).toBe('worksheet')
    })

    it(`คาบ ${s.session}: ไม่มีเฉลยลอย (ไม่มีข้อในเนื้อหา)`, () => {
      const ids = new Set([...questions.map(([q]) => q.id), s.worksheet?.item_id])
      expect(keys.filter((k) => !ids.has(k.item_id)).map((k) => k.item_id)).toEqual([])
    })

    it(`คาบ ${s.session}: เปิดคาบมีคำถามก่อนเรียน (คาบ 1–2) และเป้าหมายถ้ามีต้องมี 2–4 ข้อ`, () => {
      if (s.session <= 2) expect(s.intro?.bigQuestion.length).toBeGreaterThan(10)
      if (s.intro?.goals) expect(s.intro.goals.length).toBeGreaterThanOrEqual(2)
    })

    it(`คาบ ${s.session}: ทุกการ์ดมีภาพ และภาพมีอยู่จริง`, () => {
      for (const c of s.cards) {
        expect(c.blocks.some((b) => VISUAL_KINDS.includes(b.kind)), c.id).toBe(true)
        for (const b of c.blocks) {
          if (b.kind === 'figure') expect(FIGURES[b.name], b.name).toBeDefined()
          if (b.kind === 'steps') for (const st of b.steps) if (st.figure) expect(FIGURES[st.figure], st.figure).toBeDefined()
        }
      }
    })
  }
})

describe('คำตอบที่กำลังทำ', () => {
  const order: Question = { id: 'o', type: 'order', prompt: '', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }
  const match: Question = {
    id: 'm',
    type: 'match',
    prompt: '',
    left: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }],
    right: [{ id: '1', text: '1' }, { id: '2', text: '2' }],
  }

  it('เริ่มต้นตามชนิดคำถาม', () => {
    expect(initialDraft({ id: 'q', type: 'mcq', prompt: '', choices: ['a', 'b'] })).toEqual({ choice: null })
    expect(initialDraft(order)).toEqual({ order: ['a', 'b'] })
  })

  it('ต้องตอบครบก่อนตรวจ', () => {
    expect(isDraftComplete(match, { pairs: { x: '1' } })).toBe(false)
    expect(isDraftComplete(match, { pairs: { x: '1', y: '2' } })).toBe(true)
    expect(isDraftComplete({ id: 'f', type: 'fill', prompt: '' }, { text: '   ' })).toBe(false)
    expect(isDraftComplete(order, initialDraft(order))).toBe(true)
  })

  it('เลือกหลายข้อ / เลื่อนลำดับ', () => {
    expect(toggleChoice([2], 0)).toEqual([0, 2])
    expect(toggleChoice([0, 2], 2)).toEqual([0])
    expect(moveId(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveId(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})
