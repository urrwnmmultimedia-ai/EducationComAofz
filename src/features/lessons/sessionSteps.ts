import { z } from 'zod'
import type { Json } from '@/lib/database.types'

export const STEP_KEYS = ['warmup', 'content', 'game', 'work', 'exit', 'summary'] as const
export type StepKey = (typeof STEP_KEYS)[number]

// คะแนนเกมขั้นต่ำ (0–100) ที่ถือว่าผ่านขั้น "เกม" ของคาบ
export const GAME_PASS_SCORE = 50

// ช่องไกด์คำตอบของขั้นเปิดคาบ: ป้ายบอกว่าช่องนี้ให้ตอบอะไร + ตัวอย่างประโยคเริ่ม (ไม่ใช่เฉลย)
export const guideSlotSchema = z.object({ label: z.string(), hint: z.string().optional() })
export type GuideSlot = z.infer<typeof guideSlotSchema>

export const stepSchema = z.object({
  key: z.enum(STEP_KEYS),
  label: z.string(),
  minutes: z.number().int().nonnegative(),
  items: z.array(z.string()).optional(),
  // ขั้นเปิดคาบแบบ DB Quest (ไม่บังคับ): คำถามใหญ่ให้เดาก่อนเรียน เรียนไปทำไม และเป้าหมายของคาบ
  question: z.string().optional(),
  why: z.string().optional(),
  goals: z.array(z.string()).optional(),
  // ช่องไกด์คำตอบ แยกตามคำถาม (คำถามใหญ่ question = ชุดแรก · คำถามชวนคิด items[i] = ชุดที่ i)
  // ข้อมูลเสียให้ถือว่าไม่มี ไม่ทำให้ขั้นตอนทั้งคาบกลายเป็นค่าเริ่มต้น
  guide: z.array(z.array(guideSlotSchema)).optional().catch(undefined),
})
export type SessionStep = z.infer<typeof stepSchema>

export const DEFAULT_STEPS: SessionStep[] = [
  { key: 'warmup', label: 'อุ่นเครื่อง / ทบทวน', minutes: 10, items: [] },
  { key: 'content', label: 'เนื้อหา', minutes: 30 },
  { key: 'game', label: 'เกม', minutes: 20 },
  { key: 'work', label: 'งาน / กิจกรรม', minutes: 45 },
  { key: 'exit', label: 'Exit ticket', minutes: 10 },
  { key: 'summary', label: 'สรุป', minutes: 5, items: [] },
]

// อ่าน steps jsonb จาก DB อย่างปลอดภัย: ข้อมูลเสียหรือว่างใช้ค่าเริ่มต้น
export function parseSteps(raw: Json): SessionStep[] {
  const parsed = z.array(stepSchema).safeParse(raw)
  if (!parsed.success || parsed.data.length === 0) return DEFAULT_STEPS
  return parsed.data
}

export function totalMinutes(steps: SessionStep[]): number {
  return steps.reduce((sum, s) => sum + s.minutes, 0)
}

// ความคืบหน้าทั้งวิชา (0–100): นับทุกคาบ รวมคาบที่ยังไม่เปิด — ขั้นที่ทำเสร็จ / ขั้นทั้งหมดของทุกคาบ
export function courseProgressPercent(items: { completed_steps: string[]; total_steps: number }[]): number {
  const total = items.reduce((s, i) => s + i.total_steps, 0)
  if (total === 0) return 0
  const done = items.reduce((s, i) => s + Math.min(i.completed_steps.length, i.total_steps), 0)
  return Math.round((done / total) * 100)
}

// ความคืบหน้า (0–100) ของชุดคาบ: นับขั้นตอนที่ทำเสร็จ / ขั้นตอนทั้งหมดของคาบที่เปิดแล้ว
export function progressPercent(items: { is_unlocked: boolean; completed_steps: string[]; total_steps: number }[]): number {
  const open = items.filter((i) => i.is_unlocked)
  const total = open.reduce((s, i) => s + i.total_steps, 0)
  if (total === 0) return 0
  const done = open.reduce((s, i) => s + Math.min(i.completed_steps.length, i.total_steps), 0)
  return Math.round((done / total) * 100)
}

export interface WarmupQuestion {
  text: string
  slots: GuideSlot[]
}

const FREE_SLOT: GuideSlot = { label: 'คำตอบของฉัน', hint: 'ตอบสั้น ๆ ตามที่คิด ไม่มีถูกผิด' }

// คำถามเปิดคาบพร้อมช่องให้ตอบ: ไม่มีไกด์ = ช่องเดียวต่อคำถาม
export function warmupQuestions(step: SessionStep): WarmupQuestion[] {
  const texts = step.question ? [step.question] : (step.items ?? [])
  return texts.map((text, i) => {
    const slots = (step.guide?.[i] ?? []).filter((s) => s.label.trim())
    return { text, slots: slots.length ? slots : [FREE_SLOT] }
  })
}

// รวมคำตอบทุกช่องเป็นข้อความเดียว (แสดงตอนสรุปท้ายคาบ)
export function composeGuess(questions: WarmupQuestion[], answers: string[][]): string {
  const multi = questions.length > 1
  return questions
    .map((q, i) => {
      const lines = q.slots.flatMap((s, j) => {
        const a = answers[i]?.[j]?.trim()
        if (!a) return []
        return [s === FREE_SLOT ? a : `${s.label}: ${a}`]
      })
      if (!lines.length) return ''
      return multi ? [`${i + 1}. ${q.text}`, ...lines.map((l) => `   ${l}`)].join('\n') : lines.join('\n')
    })
    .filter(Boolean)
    .join('\n')
}

// ฟอร์มครู: บรรทัดละช่อง "ป้าย | ตัวอย่าง" · บรรทัด "---" = ขึ้นคำถามถัดไป
export function formatGuide(guide: GuideSlot[][] | undefined): string {
  return (guide ?? []).map((g) => g.map((s) => (s.hint ? `${s.label} | ${s.hint}` : s.label)).join('\n')).join('\n---\n')
}

export function parseGuide(text: string): GuideSlot[][] | undefined {
  const groups = text.split(/^\s*---\s*$/m).map((block) =>
    block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l): GuideSlot => {
        const at = l.indexOf('|')
        const label = (at >= 0 ? l.slice(0, at) : l).trim()
        const hint = at >= 0 ? l.slice(at + 1).trim() : ''
        return hint ? { label, hint } : { label }
      }),
  )
  return groups.some((g) => g.length) ? groups : undefined
}

