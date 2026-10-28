import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { StepKey } from '@/content/course'

// เรียก RPC ของคาบเรียน DB Quest — เซิร์ฟเวอร์ตรวจคำตอบเอง หน้าเว็บไม่เคยเห็นเฉลย

const stepKey = z.enum(['warmup', 'lesson', 'practice', 'game', 'worksheet', 'wrapup'])

const mapSchema = z.array(
  z.object({
    session_no: z.number(),
    unit_no: z.number().nullable(),
    kind: z.string(),
    title: z.string(),
    open: z.boolean(),
    pct: z.number().nullable(),
  }),
)
export type MapItem = z.infer<typeof mapSchema>[number]

const submissionSchema = z.object({
  content: z.object({ text: z.string() }).partial(),
  score: z.number().nullable(),
  max_score: z.number(),
  feedback: z.string().nullable(),
  submitted_at: z.string(),
  graded_at: z.string().nullable(),
})
export type Submission = z.infer<typeof submissionSchema>

const stateSchema = z.object({
  session_no: z.number(),
  steps: z.array(stepKey),
  done: z.record(z.string(), z.unknown()),
  solved: z.array(z.string()),
  attempted: z.array(z.string()),
  submissions: z.record(z.string(), submissionSchema),
  pct: z.number().nullable(),
  preview: z.boolean(),
})
export type SessionState = z.infer<typeof stateSchema>

const checkSchema = z.object({ correct: z.boolean(), score: z.number(), hint: z.string().nullable(), xp: z.number() })
export type CheckResult = z.infer<typeof checkSchema>

const completeSchema = z.object({
  ok: z.boolean(),
  xp: z.number(),
  pct: z.number().nullable(),
  preview: z.boolean().optional(),
  badges: z.array(z.string()).optional(),
})
export type CompleteResult = z.infer<typeof completeSchema>

const worksheetSchema = z.object({ ok: z.boolean(), xp: z.number() })

// ข้อความ error จากเซิร์ฟเวอร์ -> ภาษาคน
const ERRORS: Record<string, string> = {
  locked: 'คาบนี้ยังล็อกอยู่ ทำคาบก่อนหน้าให้ครบก่อนนะ',
  incomplete: 'ยังทำขั้นนี้ไม่ครบ ลองดูอีกทีว่าเหลืออะไร',
  invalid_content: 'ยังไม่ได้พิมพ์คำตอบ',
  already_graded: 'ครูตรวจใบงานนี้แล้ว แก้ไม่ได้',
  not_found: 'ไม่พบข้อมูลนี้',
  forbidden: 'ไม่มีสิทธิ์ใช้งานส่วนนี้',
}

export class DbqError extends Error {
  constructor(public code: string) {
    super(ERRORS[code] ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
}

async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
  // ชื่อฟังก์ชันมี type ใน database.types แต่รวมเป็นตัวเดียวเพื่อแปลง error ที่เดียว
  const { data, error } = await supabase.rpc(fn as 'dbq_me', args as never)
  if (error) throw new DbqError(error.message)
  return data
}

export async function fetchMap(): Promise<MapItem[]> {
  return mapSchema.parse(await rpc('dbq_my_map'))
}

export async function fetchSessionState(no: number): Promise<SessionState> {
  return stateSchema.parse(await rpc('dbq_session_state', { p_session: no }))
}

export async function checkAnswer(itemId: string, response: Json): Promise<CheckResult> {
  return checkSchema.parse(await rpc('dbq_check_answer', { p_item_id: itemId, p_response: response }))
}

export async function completeStep(no: number, step: StepKey, data: Json = {}): Promise<CompleteResult> {
  return completeSchema.parse(await rpc('dbq_complete_step', { p_session: no, p_step: step, p_data: data }))
}

export async function submitWorksheet(itemId: string, text: string): Promise<{ ok: boolean; xp: number }> {
  return worksheetSchema.parse(await rpc('dbq_submit_worksheet', { p_item_id: itemId, p_content: { text } }))
}
