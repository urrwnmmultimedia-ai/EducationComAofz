import { z } from 'zod'
import type { Json } from '@/lib/database.types'

export const rubricSchema = z.array(z.object({ criterion: z.string(), points: z.number().nonnegative() }))
export type Rubric = z.infer<typeof rubricSchema>

// ใบงานแบบไกด์ (ไม่บังคับ ทุกช่องเสียได้โดยไม่ทำให้ตารางพัง):
//   rowLabels  ป้ายคอลัมน์แรกของแต่ละแถว (กรอกให้เอง นักเรียนแก้ไม่ได้) เช่น อดีต / ปัจจุบัน / อนาคต
//   hints      ตัวอย่างประโยคเริ่มในช่องของแต่ละคอลัมน์ · chips  คำให้แตะเติมในช่องของแต่ละคอลัมน์
//   steps      ขั้นตอนทำใบงาน · topic  ช่อง "เลือกเรื่อง" ก่อนกรอกตาราง (เก็บใน content.text)
//   example    ตัวอย่างที่ทำเสร็จแล้ว (เรื่องอื่น) ให้กดดู
const loose = <T extends z.ZodType>(t: T) => t.optional().catch(undefined)
export const tableConfigSchema = z.object({
  columns: z.array(z.string()).min(1).max(8).default(['คำตอบ']),
  rows: z.number().int().min(1).max(30).default(3),
  rowLabels: loose(z.array(z.string())),
  hints: loose(z.array(z.string())),
  chips: loose(z.array(z.array(z.string()))),
  steps: loose(z.array(z.string())),
  topic: loose(z.object({ label: z.string(), hint: z.string().optional(), choices: z.array(z.string()).optional() })),
  example: loose(z.object({ topic: z.string().optional(), rows: z.array(z.array(z.string())) })),
})
export type TableConfig = z.infer<typeof tableConfigSchema>

// ใบงานตารางที่ครูใส่ตัวไกด์ไว้ → แสดงเป็นการ์ดทีละแถว
export function isGuidedTable(config: TableConfig): boolean {
  return !!(config.rowLabels?.length || config.topic || config.steps?.length)
}

// ช่องที่นักเรียนต้องกรอก (ไม่นับคอลัมน์ป้ายแถว) และกรอกแล้วกี่ช่อง
export function guidedProgress(config: TableConfig, content: SubmissionContent): { filled: number; total: number } {
  const rows = normalizeRows(content.rows, config)
  const firstEditable = config.rowLabels?.length ? 1 : 0
  let filled = 0
  let total = 0
  rows.slice(0, config.rows).forEach((row) =>
    row.forEach((cell, c) => {
      if (c < firstEditable) return
      total++
      if (cell.trim()) filled++
    }),
  )
  if (config.topic) {
    total++
    if (content.text?.trim()) filled++
  }
  return { filled, total }
}

export const submissionContentSchema = z.object({
  text: z.string().max(20000).optional(),
  rows: z.array(z.array(z.string().max(2000))).max(50).optional(),
  url: z.string().max(2000).optional(),
})
export type SubmissionContent = z.infer<typeof submissionContentSchema>

export function parseRubric(raw: Json): Rubric {
  const p = rubricSchema.safeParse(raw)
  return p.success ? p.data : []
}

export function parseTableConfig(raw: Json): TableConfig {
  const p = tableConfigSchema.safeParse(raw ?? {})
  return p.success ? p.data : { columns: ['คำตอบ'], rows: 3 }
}

export function parseContent(raw: Json): SubmissionContent {
  const p = submissionContentSchema.safeParse(raw ?? {})
  return p.success ? p.data : {}
}

// ตารางคำตอบให้ขนาดตรงกับ config เสมอ (ข้อมูลเกินถูกตัด ขาดเติมช่องว่าง)
export function normalizeRows(rows: string[][] | undefined, config: TableConfig): string[][] {
  return Array.from({ length: Math.max(config.rows, rows?.length ?? 0) }, (_, r) =>
    config.columns.map((_, c) => (c === 0 && config.rowLabels?.[r] ? config.rowLabels[r] : (rows?.[r]?.[c] ?? ''))),
  )
}

export const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export function validateFile(file: { name: string; type: string; size: number }): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return `ไฟล์ "${file.name}" ไม่รองรับ (ส่งได้เฉพาะรูปภาพหรือ PDF)`
  if (file.size > MAX_FILE_BYTES) return `ไฟล์ "${file.name}" ใหญ่เกิน 10 MB`
  return null
}

export function storagePath(studentId: string, assignmentId: string, fileName: string, now = Date.now()): string {
  const dot = fileName.lastIndexOf('.')
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return `${studentId}/${assignmentId}/${now}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ''}`
}

// ตรวจว่ามีเนื้อหาพอจะส่งหรือยัง
export function isContentEmpty(type: string, content: SubmissionContent, fileCount: number): boolean {
  switch (type) {
    case 'text':
      return !content.text?.trim()
    case 'table':
      return !(content.rows ?? []).some((r) => r.some((c) => c.trim()))
    case 'file':
      return fileCount === 0
    case 'link':
      return !content.url?.trim()
    default:
      return true
  }
}

export function isValidHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
