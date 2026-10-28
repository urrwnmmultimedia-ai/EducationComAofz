import { z } from 'zod'
import type { QuestionRow } from '@/lib/database.types'
import type { QuestionType } from '@/features/exams/examModel'

// รูปแบบไฟล์ให้ครูแก้ใน Excel ได้ง่าย (ตัวเลือกคั่นด้วย ;)
//   mcq        ตัวเลือก: ก;ข;ค;ง          เฉลย: 1–4
//   true_false                             เฉลย: ถูก / ผิด
//   fill                                   เฉลย: คำตอบที่รับได้ คั่นด้วย ;
//   matching   ตัวเลือก: ซ้าย=ขวา;ซ้าย=ขวา
//   ordering   ตัวเลือก: เรียงตามลำดับที่ถูก
//   short      (ครูตรวจ)
export const CSV_HEADER = ['id', 'หน่วย', 'หัวข้อ', 'ตัวชี้วัด', 'ประเภท', 'ระดับ', 'คำถาม', 'ตัวเลือก', 'เฉลย', 'คำอธิบาย', 'ตรวจแล้ว']

const TYPE_ALIASES: Record<string, QuestionType> = {
  mcq: 'mcq',
  ปรนัย: 'mcq',
  tf: 'true_false',
  true_false: 'true_false',
  'ถูกผิด': 'true_false',
  'ถูก/ผิด': 'true_false',
  fill: 'fill',
  เติมคำ: 'fill',
  match: 'matching',
  matching: 'matching',
  จับคู่: 'matching',
  order: 'ordering',
  ordering: 'ordering',
  เรียงลำดับ: 'ordering',
  short: 'short',
  อัตนัย: 'short',
  ตอบสั้น: 'short',
}
const DIFF: Record<string, QuestionRow['difficulty']> = { easy: 'easy', ง่าย: 'easy', medium: 'medium', กลาง: 'medium', hard: 'hard', ยาก: 'hard' }

const split = (v: string) => v.split(';').map((s) => s.trim()).filter(Boolean)

export interface QuestionDraft {
  id: string | null
  unitNo: number | null
  topic: string
  indicator: number | null
  type: QuestionType
  difficulty: QuestionRow['difficulty']
  prompt: string
  choices: QuestionRow['choices']
  correct_answer: QuestionRow['correct_answer']
  explanation: string
  reviewed: boolean
}

// สลับลำดับ (สุ่มจริง) โดยไม่ให้ตรงลำดับเดิม
export function shuffleIndices(n: number, random: () => number = Math.random): number[] {
  for (let tries = 0; tries < 20; tries++) {
    const idx = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j] as number, idx[i] as number]
    }
    if (n < 2 || idx.some((v, i) => v !== i)) return idx
  }
  return Array.from({ length: n }, (_, i) => n - 1 - i)
}

// ข้อความ "ตัวเลือก/เฉลย" ⇄ choices/correct_answer ใน DB
export function encodeAnswerFields(type: QuestionType, choicesText: string, answerText: string, random?: () => number) {
  const items = split(choicesText)
  switch (type) {
    case 'mcq': {
      const n = Number(answerText.trim())
      if (items.length < 2 || items.length > 6) throw new Error('ปรนัยต้องมี 2–6 ตัวเลือก')
      if (!Number.isInteger(n) || n < 1 || n > items.length) throw new Error(`เฉลยต้องเป็นเลข 1–${items.length}`)
      return { choices: items, correct_answer: { index: n - 1 } }
    }
    case 'true_false': {
      const v = answerText.trim().toLowerCase()
      if (!['ถูก', 'ผิด', 't', 'f', 'true', 'false'].includes(v)) throw new Error('เฉลยต้องเป็น ถูก หรือ ผิด')
      return { choices: [], correct_answer: { value: v === 'ถูก' || v === 't' || v === 'true' } }
    }
    case 'fill': {
      const accept = split(answerText)
      if (accept.length === 0) throw new Error('ต้องมีคำตอบที่ยอมรับอย่างน้อย 1 คำ')
      return { choices: [], correct_answer: { accept } }
    }
    case 'matching': {
      const pairs = items.map((p) => p.split('=').map((x) => x.trim()))
      if (pairs.length < 2 || pairs.some((p) => p.length !== 2 || !p[0] || !p[1])) throw new Error('จับคู่ต้องเป็น ซ้าย=ขวา อย่างน้อย 2 คู่')
      const perm = shuffleIndices(pairs.length, random)
      return {
        choices: { left: pairs.map((p) => p[0] as string), right: perm.map((i) => (pairs[i] as string[])[1] as string) },
        correct_answer: { pairs: pairs.map((_, i) => perm.indexOf(i)) },
      }
    }
    case 'ordering': {
      if (items.length < 2) throw new Error('เรียงลำดับต้องมีอย่างน้อย 2 ขั้น')
      const perm = shuffleIndices(items.length, random)
      return { choices: perm.map((i) => items[i] as string), correct_answer: { order: items.map((_, i) => perm.indexOf(i)) } }
    }
    case 'short':
      return { choices: [], correct_answer: null }
  }
}

const mcqSchema = z.object({ index: z.number() })
const orderSchema = z.object({ order: z.array(z.number()) })
const pairsSchema = z.object({ pairs: z.array(z.number()) })
const matchSchema = z.object({ left: z.array(z.string()), right: z.array(z.string()) })

export function decodeAnswerFields(q: Pick<QuestionRow, 'type' | 'choices' | 'correct_answer'>): { choices: string; answer: string } {
  const list = Array.isArray(q.choices) ? (q.choices as string[]) : []
  switch (q.type) {
    case 'mcq': {
      const c = mcqSchema.safeParse(q.correct_answer)
      return { choices: list.join(';'), answer: c.success ? String(c.data.index + 1) : '' }
    }
    case 'true_false':
      return { choices: '', answer: (q.correct_answer as { value?: boolean } | null)?.value ? 'ถูก' : 'ผิด' }
    case 'fill':
      return { choices: '', answer: ((q.correct_answer as { accept?: string[] } | null)?.accept ?? []).join(';') }
    case 'matching': {
      const m = matchSchema.safeParse(q.choices)
      const c = pairsSchema.safeParse(q.correct_answer)
      if (!m.success || !c.success) return { choices: '', answer: '' }
      return { choices: m.data.left.map((l, i) => `${l}=${m.data.right[c.data.pairs[i] ?? -1] ?? ''}`).join(';'), answer: '' }
    }
    case 'ordering': {
      const c = orderSchema.safeParse(q.correct_answer)
      return { choices: c.success ? c.data.order.map((i) => list[i]).join(';') : list.join(';'), answer: '' }
    }
    case 'short':
      return { choices: '', answer: '' }
  }
}

export function questionToCsvRow(q: QuestionRow, unitNoById: Map<string, number>): (string | number)[] {
  const { choices, answer } = decodeAnswerFields(q)
  return [
    q.id,
    q.unit_id ? (unitNoById.get(q.unit_id) ?? '') : '',
    q.topic,
    q.indicator ?? '',
    q.type,
    q.difficulty,
    q.prompt,
    choices,
    answer,
    q.explanation,
    q.reviewed ? 'ใช่' : '',
  ]
}

export interface CsvParseResult {
  drafts: QuestionDraft[]
  issues: { line: number; message: string }[]
}

export function parseQuestionTable(table: unknown[][], random?: () => number): CsvParseResult {
  const [header, ...rows] = table
  const h = (header ?? []).map((x) => String(x ?? '').trim())
  const col = (name: string) => h.indexOf(name)
  const need = ['ประเภท', 'คำถาม']
  const missing = need.filter((n) => col(n) < 0)
  if (missing.length) return { drafts: [], issues: [{ line: 1, message: `ไม่พบคอลัมน์: ${missing.join(', ')}` }] }
  const get = (r: unknown[], name: string) => (col(name) >= 0 ? String(r[col(name)] ?? '').trim() : '')

  const drafts: QuestionDraft[] = []
  const issues: CsvParseResult['issues'] = []
  rows.forEach((r, i) => {
    const line = i + 2
    if (r.every((c) => String(c ?? '').trim() === '')) return
    try {
      const type = TYPE_ALIASES[get(r, 'ประเภท').toLowerCase()]
      if (!type) throw new Error(`ประเภท "${get(r, 'ประเภท')}" ไม่รู้จัก`)
      const prompt = get(r, 'คำถาม')
      if (!prompt) throw new Error('ไม่มีคำถาม')
      const unitText = get(r, 'หน่วย')
      const indText = get(r, 'ตัวชี้วัด')
      const id = get(r, 'id')
      drafts.push({
        id: /^[0-9a-f-]{36}$/i.test(id) ? id : null,
        unitNo: unitText ? Number(unitText) : null,
        topic: get(r, 'หัวข้อ'),
        indicator: indText ? Number(indText) : null,
        type,
        difficulty: DIFF[get(r, 'ระดับ').toLowerCase()] ?? 'medium',
        prompt,
        ...encodeAnswerFields(type, get(r, 'ตัวเลือก'), get(r, 'เฉลย'), random),
        explanation: get(r, 'คำอธิบาย'),
        reviewed: ['ใช่', 'yes', 'true', '1', '✓'].includes(get(r, 'ตรวจแล้ว').toLowerCase()),
      })
    } catch (e) {
      issues.push({ line, message: e instanceof Error ? e.message : 'ข้อมูลไม่ถูกต้อง' })
    }
  })
  return { drafts, issues }
}
