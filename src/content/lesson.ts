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
// แผนภาพลำดับขั้น (วิ่งเอง/แตะดูทีละขั้น) และสื่อโต้ตอบที่เขียนเป็นโค้ด (ชื่อต้องตรงกับ DBQ_WIDGETS ใน lesson/widgets.tsx)
const flowBlock = z.object({
  kind: z.literal('flow'),
  title: z.string(),
  cycle: z.boolean().optional(),
  nodes: z.array(z.object({ icon: z.string(), label: z.string(), md: z.string() })).min(2),
})
const widgetBlock = z.object({ kind: z.literal('widget'), name: z.string() })
// เกมซ้อมเร็ว (ไม่คิดคะแนน ตรวจในเครื่อง): แตะกลุ่มที่ใช่ให้ทันเวลา — group = ลำดับใน groups
const drillBlock = z.object({
  kind: z.literal('drill'),
  title: z.string(),
  groups: z.array(z.string()).min(2).max(4),
  items: z.array(z.object({ text: z.string(), group: z.number().int().min(0) })).min(4),
  rounds: z.number().int().min(3).max(20).optional(),
})
const stepsBlock = z.object({
  kind: z.literal('steps'),
  title: z.string(),
  steps: z.array(z.object({ title: z.string(), md: z.string(), figure: z.string().optional() })).min(2),
})

export const blockSchema = z.discriminatedUnion('kind', [
  textBlock, figureBlock, tableBlock, codeBlock, realLifeBlock, tipBlock, warningBlock, beforeAfterBlock, stepsBlock, flowBlock, widgetBlock, drillBlock,
])
export type Block = z.infer<typeof blockSchema>

// บล็อกที่นับเป็น "ภาพ" (ทุกการ์ดต้องมีอย่างน้อย 1)
export const VISUAL_KINDS: Block['kind'][] = ['figure', 'table', 'code', 'beforeAfter', 'steps', 'flow', 'widget', 'drill']

// ช่องไกด์คำตอบเปิดคาบ: ป้าย = ให้เขียนอะไร, hint = ประโยคตัวอย่าง (ไม่ใช่คำตอบ)
export const guideSlotSchema = z.object({ label: z.string().min(1), hint: z.string().optional() })
export type GuideSlot = z.infer<typeof guideSlotSchema>

export const sessionContentSchema = z.object({
  session: z.number().int().min(1).max(20),
  // เปิดคาบ: คำถามก่อนเรียน (+ เรียนไปทำไม / เป้าหมาย ถ้ามี) — ปิดคาบถามซ้ำเป็นคำถามหลังเรียนและย้อนดูเป้าหมายเดิม
  intro: z
    .object({
      bigQuestion: z.string().min(1),
      why: z.string().min(1).optional(),
      goals: z.array(z.string().min(1)).min(2).max(4).optional(),
      // มีไกด์ = คาบแบบใหม่ (ช่องไกด์คำตอบ + ขั้นมีมิติ)
      guide: z.array(guideSlotSchema).min(1).max(4).optional(),
      // ปิดคาบ: อธิบายคำถามก่อนเรียนด้วยสิ่งที่เรียนมา (แสดงหลังนักเรียนเขียนคำตอบหลังเรียน)
      recap: z.string().min(1).optional(),
    })
    .optional(),
  warmup: z.array(z.string()).max(3),
  // ช่องไกด์ของคำถามชวนคิดแต่ละข้อ (ตรงลำดับกับ warmup)
  warmupGuide: z.array(z.array(guideSlotSchema).max(4)).max(3).optional(),
  cards: z
    .array(
      z.object({
        id: idSchema,
        title: z.string(),
        // ภารกิจของการ์ด (ไกด์ขั้นบทเรียน)
        goal: z.string().optional(),
        icon: z.string().optional(),
        blocks: z.array(blockSchema).min(1),
        check: questionSchema,
      }),
    )
    .min(1),
  practice: z.array(questionSchema),
  // ขั้นฝึกปฏิบัติแบบด่าน (ตรงลำดับกับ practice): ไอคอน ชื่อด่าน คำใบ้ และตัวช่วยทบทวน (ชื่อ widget)
  practiceLevels: z
    .array(z.object({ icon: z.string(), title: z.string(), tip: z.string().optional(), widget: z.string().optional() }))
    .optional(),
  // ฝึกเพิ่มหลังทำด่านครบ (เช่น drill) — ไม่คิดคะแนน
  practiceBonus: z.array(blockSchema).optional(),
  game: z.object({ slug: idSchema, title: z.string(), description: z.string() }).optional(),
  worksheet: z
    .object({
      item_id: idSchema,
      title: z.string(),
      instructions: z.string(),
      type: z.enum(['text', 'file', 'er', 'sql']),
      max_score: z.number().positive(),
      // ใบงานแบบตาราง (ส่งเป็นข้อความ JSON ผ่านช่อง text เดิม) — ไม่มี = ช่องพิมพ์ข้อความธรรมดา
      table: z
        .object({
          minFields: z.number().int().min(1).max(8),
          maxFields: z.number().int().min(1).max(10),
          rows: z.number().int().min(1).max(10),
          // เพิ่มส่วน "ทำไมต้องใช้ฐานข้อมูล" / "ตั้งคำถามสืบค้น + คำตอบ"
          why: z.boolean().optional(),
          query: z.boolean().optional(),
        })
        .refine((t) => t.maxFields >= t.minFields)
        .optional(),
    })
    .optional(),
  // ปิดคาบ: ภารกิจคิดรวบยอด (สถานการณ์ + คำถามหลายแบบ ตรวจที่เซิร์ฟเวอร์ — เฉลยอยู่ใน answer_keys item_type 'wrapup')
  closing: z
    .object({
      title: z.string().min(1),
      blocks: z.array(blockSchema),
      questions: z.array(questionSchema).min(1),
      levels: z
        .array(z.object({ icon: z.string(), title: z.string(), tip: z.string().optional(), widget: z.string().optional() }))
        .optional(),
    })
    .optional(),
  summary: z.array(z.string()).length(3),
  // ปิดคาบแบบใหม่: ผังสรุปทีละคำ (ไอคอน คำสำคัญ คำอธิบาย) + สื่อสรุป (ชื่อ widget)
  recap: z
    .object({
      items: z.array(z.object({ icon: z.string(), term: z.string(), md: z.string() })).min(2),
      widget: z.string().optional(),
    })
    .optional(),
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
