import { z } from 'zod'
import type { Json } from '@/lib/database.types'

export const STEP_KEYS = ['warmup', 'content', 'game', 'work', 'exit', 'summary'] as const
export type StepKey = (typeof STEP_KEYS)[number]

export const stepSchema = z.object({
  key: z.enum(STEP_KEYS),
  label: z.string(),
  minutes: z.number().int().nonnegative(),
  items: z.array(z.string()).optional(),
  // ขั้นเปิดคาบแบบ DB Quest (ไม่บังคับ): คำถามใหญ่ให้เดาก่อนเรียน เรียนไปทำไม และเป้าหมายของคาบ
  question: z.string().optional(),
  why: z.string().optional(),
  goals: z.array(z.string()).optional(),
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

// ความคืบหน้า (0–100) ของชุดคาบ: นับขั้นตอนที่ทำเสร็จ / ขั้นตอนทั้งหมดของคาบที่เปิดแล้ว
export function progressPercent(items: { is_unlocked: boolean; completed_steps: string[]; total_steps: number }[]): number {
  const open = items.filter((i) => i.is_unlocked)
  const total = open.reduce((s, i) => s + i.total_steps, 0)
  if (total === 0) return 0
  const done = open.reduce((s, i) => s + Math.min(i.completed_steps.length, i.total_steps), 0)
  return Math.round((done / total) * 100)
}
