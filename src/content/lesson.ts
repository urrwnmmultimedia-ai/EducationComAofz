import { z } from 'zod'

// รูปแบบไฟล์เนื้อหาคาบ src/content/units/sNN.json — มีแค่โจทย์/ตัวเลือก ห้ามมีเฉลย
// (เฉลยอยู่ที่ supabase/answer_keys/sNN.json แล้วถูกสร้างเป็น supabase/seed/answer_keys.sql)

const idSchema = z.string().regex(/^[a-z0-9-]{1,64}$/)
const option = z.object({ id: z.string().min(1), text: z.string().min(1) })

export const questionSchema = z.discriminatedUnion('type', [
  z.object({ id: idSchema, type: z.literal('mcq'), prompt: z.string(), choices: z.array(z.string()).min(2) }),
  z.object({ id: idSchema, type: z.literal('multi'), prompt: z.string(), choices: z.array(z.string()).min(2) }),
  z.object({ id: idSchema, type: z.literal('fill'), prompt: z.string(), placeholder: z.string().optional() }),
  z.object({ id: idSchema, type: z.literal('order'), prompt: z.string(), items: z.array(option).min(2) }),
  z.object({ id: idSchema, type: z.literal('match'), prompt: z.string(), left: z.array(option).min(2), right: z.array(option).min(2) }),
  z.object({ id: idSchema, type: z.literal('classify'), prompt: z.string(), items: z.array(option).min(2), categories: z.array(option).min(2) }),
])
export type Question = z.infer<typeof questionSchema>

const column = z.object({ name: z.string(), role: z.enum(['pk', 'fk']).optional() })
const tableData = z.object({
  title: z.string().optional(),
  columns: z.array(column).min(1),
  rows: z.array(z.array(z.string())),
  highlight: z.object({ rows: z.array(z.number().int()).optional(), cols: z.array(z.number().int()).optional(), tone: z.enum(['bad', 'good']) }).optional(),
})
export type TableData = z.infer<typeof tableData>

const textBlock = z.object({ kind: z.literal('text'), md: z.string() })
const figureBlock = z.object({ kind: z.literal('figure'), name: z.string(), caption: z.string(), alt: z.string() })
const tableBlock = tableData.extend({ kind: z.literal('table'), caption: z.string() })
const codeBlock = z.object({
  kind: z.literal('code'),
  sql: z.string(),
  caption: z.string().optional(),
  result: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
})
const realLifeBlock = z.object({ kind: z.literal('reallife'), title: z.string(), md: z.string(), icon: z.string().optional() })
const tipBlock = z.object({ kind: z.literal('tip'), md: z.string() })
const warningBlock = z.object({ kind: z.literal('warning'), md: z.string() })
const beforeAfterBlock = z.object({
  kind: z.literal('beforeAfter'),
  caption: z.string(),
  before: tableData,
  after: z.array(tableData).min(1),
})
const stepsBlock = z.object({
  kind: z.literal('steps'),
  title: z.string(),
  steps: z.array(z.object({ title: z.string(), md: z.string(), figure: z.string().optional() })).min(2),
})

export const blockSchema = z.discriminatedUnion('kind', [
  textBlock, figureBlock, tableBlock, codeBlock, realLifeBlock, tipBlock, warningBlock, beforeAfterBlock, stepsBlock,
])
export type Block = z.infer<typeof blockSchema>

// บล็อกที่นับเป็น "ภาพ" (ทุกการ์ดต้องมีอย่างน้อย 1)
export const VISUAL_KINDS: Block['kind'][] = ['figure', 'table', 'code', 'beforeAfter', 'steps']

export const sessionContentSchema = z.object({
  session: z.number().int().min(1).max(20),
  warmup: z.array(z.string()).length(3),
  cards: z.array(z.object({ id: idSchema, title: z.string(), blocks: z.array(blockSchema).min(1), check: questionSchema })).min(1),
  practice: z.array(questionSchema),
  game: z.object({ slug: idSchema, title: z.string(), description: z.string() }).optional(),
  worksheet: z
    .object({
      item_id: idSchema,
      title: z.string(),
      instructions: z.string(),
      type: z.enum(['text', 'file', 'er', 'sql']),
      max_score: z.number().positive(),
    })
    .optional(),
  summary: z.array(z.string()).length(3),
})
export type SessionContent = z.infer<typeof sessionContentSchema>

const loaders = import.meta.glob<{ default: unknown }>('./units/s*.json')

export function hasSessionContent(no: number): boolean {
  return `./units/s${String(no).padStart(2, '0')}.json` in loaders
}

// โหลดเนื้อหาคาบแยกไฟล์ (เปิดคาบไหนโหลดคาบนั้น)
export async function loadSessionContent(no: number): Promise<SessionContent | null> {
  const loader = loaders[`./units/s${String(no).padStart(2, '0')}.json`]
  if (!loader) return null
  return sessionContentSchema.parse((await loader()).default)
}
