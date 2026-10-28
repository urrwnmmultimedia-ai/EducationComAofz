import { z } from 'zod'

// config ของเกมเก็บใน games.config (ครูแก้ได้ในหน้าแอดมิน) — ตรวจรูปแบบด้วย schema นี้ทุกครั้ง
// เกมทั้งหมดสร้างจาก "engine" 6 แบบ: sort, sequence, quiz, boss, route, idea, shop

export const quizItemSchema = z
  .object({
    q: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).max(6),
    answer: z.number().int().min(0), // ดัชนีเริ่มที่ 0
    explain: z.string().optional(),
  })
  .refine((v) => v.answer < v.choices.length, { message: 'answer เกินจำนวนตัวเลือก' })
export type QuizItem = z.infer<typeof quizItemSchema>

const base = {
  instructions: z.string().default(''),
  timeLimitSec: z.number().int().positive().optional(),
}

export const sortConfigSchema = z
  .object({
    engine: z.literal('sort'),
    ...base,
    mode: z.enum(['board', 'stream']).default('board'),
    story: z.string().optional(),
    cardTimeSec: z.number().int().positive().optional(),
    buckets: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), icon: z.string().optional() })).min(2).max(8),
    cards: z.array(z.object({ text: z.string().min(1), bucket: z.string(), explain: z.string().optional() })).min(1).max(40),
    bonus: z.array(quizItemSchema).optional(),
  })
  .refine((c) => c.cards.every((card) => c.buckets.some((b) => b.id === card.bucket)), { message: 'การ์ดอ้างถึงกล่องที่ไม่มี' })

export const sequenceConfigSchema = z
  .object({
    engine: z.literal('sequence'),
    ...base,
    items: z.array(z.string().min(1)).min(2).max(15),
    match: z.array(z.object({ situation: z.string().min(1), step: z.number().int().min(0) })).optional(),
  })
  .refine((c) => (c.match ?? []).every((m) => m.step < c.items.length), { message: 'step ใน match เกินจำนวนขั้น' })

export const quizConfigSchema = z.object({
  engine: z.literal('quiz'),
  ...base,
  timePerQuestionSec: z.number().int().positive().optional(),
  questions: z.array(quizItemSchema).min(1).max(40),
})

export const bossConfigSchema = z.object({
  engine: z.literal('boss'),
  ...base,
  hearts: z.number().int().min(1).max(10).default(3),
  timePerQuestionSec: z.number().int().positive().optional(),
  stages: z
    .array(z.object({ name: z.string().min(1), emoji: z.string().default('👾'), questions: z.array(quizItemSchema).min(1).max(30) }))
    .min(1)
    .max(5),
})

const cell = z.tuple([z.number().int().min(0), z.number().int().min(0)])
export const routeConfigSchema = z.object({
  engine: z.literal('route'),
  ...base,
  scenarios: z.array(quizItemSchema).default([]),
  grids: z
    .array(
      z.object({
        label: z.string().default(''),
        rows: z.number().int().min(2).max(10),
        cols: z.number().int().min(2).max(10),
        start: cell,
        goal: cell,
        walls: z.array(cell).default([]),
      }),
    )
    .default([]),
})

export const ideaConfigSchema = z
  .object({
    engine: z.literal('idea'),
    ...base,
    problem: z.string(),
    criteria: z.array(z.string().min(1)).min(1).max(6),
    ideas: z.array(z.object({ name: z.string().min(1), desc: z.string(), truth: z.array(z.number().int().min(1).max(3)) })).min(2).max(5),
    reasons: z.array(z.object({ text: z.string().min(1), correct: z.boolean() })).min(2),
  })
  .refine((c) => c.ideas.every((i) => i.truth.length === c.criteria.length), { message: 'truth ต้องมีจำนวนเท่าเกณฑ์' })
  .refine((c) => c.reasons.some((r) => r.correct), { message: 'ต้องมีเหตุผลที่ถูกอย่างน้อย 1 ข้อ' })

export const shopConfigSchema = z.object({
  engine: z.literal('shop'),
  ...base,
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        emoji: z.string().default('🛍️'),
        basePrice: z.number().nonnegative(),
        budget: z.number().positive(),
        upgrades: z.array(z.object({ name: z.string().min(1), kind: z.string(), cost: z.number().positive(), value: z.number().nonnegative() })).min(2).max(10),
      }),
    )
    .min(1)
    .max(4),
})

export const gameConfigSchema = z.union([
  sortConfigSchema,
  sequenceConfigSchema,
  quizConfigSchema,
  bossConfigSchema,
  routeConfigSchema,
  ideaConfigSchema,
  shopConfigSchema,
])

export type SortConfig = z.infer<typeof sortConfigSchema>
export type SequenceConfig = z.infer<typeof sequenceConfigSchema>
export type QuizConfig = z.infer<typeof quizConfigSchema>
export type BossConfig = z.infer<typeof bossConfigSchema>
export type RouteConfig = z.infer<typeof routeConfigSchema>
export type IdeaConfig = z.infer<typeof ideaConfigSchema>
export type ShopConfig = z.infer<typeof shopConfigSchema>
export type GameConfig = z.infer<typeof gameConfigSchema>

export function parseGameConfig(raw: unknown): { ok: true; config: GameConfig } | { ok: false; error: string } {
  const p = gameConfigSchema.safeParse(raw)
  if (p.success) return { ok: true, config: p.data }
  return { ok: false, error: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 3).join(' · ') }
}
