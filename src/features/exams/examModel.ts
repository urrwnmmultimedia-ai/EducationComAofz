import { z } from 'zod'

export const QUESTION_TYPES = ['mcq', 'true_false', 'matching', 'ordering', 'fill', 'short'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'ปรนัย 4 ตัวเลือก',
  true_false: 'ถูก/ผิด',
  matching: 'จับคู่',
  ordering: 'เรียงลำดับ',
  fill: 'เติมคำ',
  short: 'ตอบสั้น/อัตนัย (ครูตรวจ)',
}

export const matchingChoicesSchema = z.object({ left: z.array(z.string()), right: z.array(z.string()) })

export const examQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  choices: z.union([z.array(z.string()), matchingChoicesSchema]),
})
export type ExamQuestion = z.infer<typeof examQuestionSchema>

// คำตอบที่ส่งไปเซิร์ฟเวอร์ (ดัชนีอ้างอิงลำดับใน DB เสมอ แม้หน้าจอสลับตัวเลือก)
export type Answer =
  | { index: number }
  | { value: boolean }
  | { pairs: (number | null)[] }
  | { order: number[] }
  | { text: string }

const answerSchema = z.union([
  z.object({ index: z.number() }),
  z.object({ value: z.boolean() }),
  z.object({ pairs: z.array(z.number().nullable()) }),
  z.object({ order: z.array(z.number()) }),
  z.object({ text: z.string() }),
])

const reviewItemSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  choices: z.union([z.array(z.string()), matchingChoicesSchema]),
  answer: z.unknown().nullable(),
  correct: z.unknown().nullable(),
  points: z.number().nullable(),
  explanation: z.string(),
})
export type ReviewItem = z.infer<typeof reviewItemSchema>

export const examResultSchema = z.object({
  attempt_id: z.string(),
  attempt_no: z.number(),
  score: z.coerce.number().nullable(),
  max_points: z.coerce.number().nullable(),
  needs_review: z.boolean(),
  submitted_at: z.string().nullable(),
  show_answers: z.boolean(),
  review: z.array(reviewItemSchema).nullable(),
})
export type ExamResult = z.infer<typeof examResultSchema>

export const startResponseSchema = z.union([
  z.object({ finished: z.literal(true), result: examResultSchema.nullable() }),
  z.object({
    attempt_id: z.string(),
    attempt_no: z.number(),
    started_at: z.string(),
    deadline_at: z.string().nullable(),
    server_now: z.string(),
    tab_switches: z.number(),
    answers: z.record(z.string(), z.unknown()),
    exam: z.object({
      id: z.string(),
      title: z.string(),
      kind: z.string(),
      shuffle_choices: z.boolean(),
      require_fullscreen: z.boolean(),
    }),
    questions: z.array(examQuestionSchema),
  }),
])
export type StartResponse = z.infer<typeof startResponseSchema>
export type ActiveAttempt = Exclude<StartResponse, { finished: true }>

export function parseAnswer(raw: unknown): Answer | null {
  const p = answerSchema.safeParse(raw)
  return p.success ? (p.data as Answer) : null
}

// ตอบครบหรือยัง (ใช้แสดงสถานะในแถบเลขข้อ)
export function isAnswered(q: ExamQuestion, a: Answer | null | undefined): boolean {
  if (!a) return false
  switch (q.type) {
    case 'mcq':
      return 'index' in a
    case 'true_false':
      return 'value' in a
    case 'matching':
      return 'pairs' in a && a.pairs.length > 0 && a.pairs.every((p) => p != null)
    case 'ordering':
      return 'order' in a && a.order.length > 0
    case 'fill':
    case 'short':
      return 'text' in a && a.text.trim().length > 0
  }
}

// สุ่มลำดับแบบกำหนด seed (ลำดับเดิมทุกครั้งที่รีเฟรชในการสอบครั้งเดียวกัน)
export function seededOrder(n: number, seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const rand = () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j] as number, idx[i] as number]
  }
  return idx
}

// ลำดับเริ่มต้นของข้อเรียงลำดับ = ลำดับที่เก็บใน DB (สลับไว้แล้ว)
export function initialOrder(q: ExamQuestion): number[] {
  return Array.isArray(q.choices) ? q.choices.map((_, i) => i) : []
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

// เวลาเหลือ (มิลลิวินาที) โดยชดเชยนาฬิกาเครื่องนักเรียนที่อาจไม่ตรงกับเซิร์ฟเวอร์
export function remainingMs(deadlineAt: string | null, serverNow: string, clientAtStart: number, clientNow: number): number | null {
  if (!deadlineAt) return null
  const offset = new Date(serverNow).getTime() - clientAtStart
  return Math.max(0, new Date(deadlineAt).getTime() - (clientNow + offset))
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const EXAM_ERROR_TEXT: Record<string, string> = {
  not_student: 'ต้องเข้าสู่ระบบด้วยรหัสนักเรียนก่อน',
  exam_not_found: 'ไม่พบชุดข้อสอบนี้',
  exam_locked: 'ครูยังไม่เปิดคาบของข้อสอบนี้',
  exam_not_open: 'ยังไม่ถึงเวลาเปิดสอบ',
  exam_closed: 'หมดเวลาทำข้อสอบชุดนี้แล้ว',
  time_up: 'หมดเวลาแล้ว ระบบกำลังส่งคำตอบให้',
  already_submitted: 'ส่งข้อสอบไปแล้ว',
}

export function examErrorText(message: string | undefined): string {
  return (message && EXAM_ERROR_TEXT[message]) || 'เกิดข้อผิดพลาด ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
}
