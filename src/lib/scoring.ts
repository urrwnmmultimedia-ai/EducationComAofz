import { z } from 'zod'
import { computeGrade, DEFAULT_GRADE_SCALE, type GradeStep } from './grade'

export const CATEGORIES = ['work', 'project', 'unit_test', 'midterm', 'final'] as const
export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category | 'affective', string> = {
  work: 'งาน/ใบกิจกรรม',
  project: 'โครงงาน',
  unit_test: 'ทดสอบท้ายหน่วย',
  midterm: 'สอบกลางภาค',
  final: 'สอบปลายภาค',
  affective: 'จิตพิสัย (จาก XP)',
}

export const scoreWeightsSchema = z.object({
  work: z.number().min(0).max(100),
  project: z.number().min(0).max(100),
  unit_test: z.number().min(0).max(100),
  midterm: z.number().min(0).max(100),
  final: z.number().min(0).max(100),
  affective: z.number().min(0).max(100).default(0),
})
export type ScoreWeights = z.infer<typeof scoreWeightsSchema>

export const DEFAULT_WEIGHTS: ScoreWeights = { work: 30, project: 15, unit_test: 15, midterm: 20, final: 20, affective: 0 }

export const gradeScaleSchema = z.array(z.object({ min: z.number().min(0).max(100), grade: z.number().min(0).max(4) })).min(1)

export function parseWeights(raw: unknown): ScoreWeights {
  const parsed = scoreWeightsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_WEIGHTS
}

export function parseGradeScale(raw: unknown): GradeStep[] {
  const parsed = gradeScaleSchema.safeParse(raw)
  return parsed.success ? parsed.data : [...DEFAULT_GRADE_SCALE]
}

export function weightsTotal(w: ScoreWeights): number {
  return CATEGORIES.reduce((s, c) => s + w[c], 0) + w.affective
}

export interface ScoringPolicy {
  weights: ScoreWeights
  gradeScale: GradeStep[]
  latePenaltyEnabled: boolean
  latePenaltyPct: number
  affectiveFullXp: number
}

export interface ScoredItem {
  id: string
  category: Category
  maxScore: number
  dueAt: string | null
  sessionNo?: number | null // คาบของงาน — งานในคาบเดียวกันรวมเป็น 1 ช่อง (ไม่มีคาบ = ช่องของตัวเอง)
}

export interface ScoreEntry {
  score: number | null
  submittedAt: string | null
}

export function isLate(item: Pick<ScoredItem, 'dueAt'>, entry: Pick<ScoreEntry, 'submittedAt'>): boolean {
  if (!item.dueAt || !entry.submittedAt) return false
  return new Date(entry.submittedAt).getTime() > new Date(item.dueAt).getTime()
}

// คะแนนหลังหักส่งช้า (ครูให้คะแนนดิบ ระบบหักให้อัตโนมัติ)
export function effectiveScore(item: ScoredItem, entry: ScoreEntry | undefined, policy: ScoringPolicy): number | null {
  if (!entry || entry.score == null) return null
  const raw = Math.min(Math.max(entry.score, 0), item.maxScore)
  if (policy.latePenaltyEnabled && isLate(item, entry)) {
    return round2(raw * (1 - policy.latePenaltyPct / 100))
  }
  return raw
}

export interface CategoryResult {
  category: Category | 'affective'
  weight: number
  raw: number // คะแนนดิบรวม (หลังหักส่งช้า)
  max: number // คะแนนเต็มรวมของทุกรายการ
  gradedMax: number // คะแนนเต็มรวมเฉพาะรายการที่มีคะแนนแล้ว
  slots: number // จำนวนคาบที่มีงานในหมวดนี้ (แต่ละคาบได้ส่วนแบ่งเท่ากัน)
  scaled: number // แปลงเป็นสัดส่วนตาม weight (คิดจากทุกคาบ ยังไม่ได้คะแนน = 0)
  gradedPct: number | null // % เฉลี่ยของคาบที่มีคะแนนแล้ว (ใช้คาดการณ์)
}

// แบ่งงานในหมวดเป็นช่องรายคาบ: คะแนนคาบ = คะแนนรวม / คะแนนเต็มของงานในคาบนั้น
// หมวดได้ = ค่าเฉลี่ยทุกคาบ × น้ำหนัก → ทำครบ 1 คาบได้แค่ส่วนแบ่งของคาบนั้น ไม่ว่าคาบนั้นจะมีคะแนนเต็มเท่าไร
function sessionSlots(inCat: ScoredItem[], entries: Map<string, ScoreEntry>, policy: ScoringPolicy) {
  const slots = new Map<string, { raw: number; max: number; gradedMax: number }>()
  for (const item of inCat) {
    if (item.maxScore <= 0) continue // งานไม่มีคะแนน (เช่น ใบงานฝึก) ไม่นับเป็นช่อง
    const key = item.sessionNo != null ? `s${item.sessionNo}` : `i${item.id}`
    const slot = slots.get(key) ?? { raw: 0, max: 0, gradedMax: 0 }
    slot.max += item.maxScore
    const eff = effectiveScore(item, entries.get(item.id), policy)
    if (eff != null) {
      slot.raw += eff
      slot.gradedMax += item.maxScore
    }
    slots.set(key, slot)
  }
  const list = [...slots.values()]
  const graded = list.filter((s) => s.gradedMax > 0)
  return {
    count: list.length,
    ratio: list.length ? list.reduce((s, x) => s + x.raw / x.max, 0) / list.length : 0,
    gradedRatio: graded.length ? graded.reduce((s, x) => s + x.raw / x.gradedMax, 0) / graded.length : null,
  }
}

export interface StudentScore {
  categories: CategoryResult[]
  total: number // 0–100 จากรายการทั้งหมด (ยังไม่ได้คะแนน = 0)
  grade: number
  predictedTotal: number | null // คาดการณ์จากรายการที่ตรวจแล้ว
  predictedGrade: number | null
}

// คำนวณคะแนนรวมของนักเรียน 1 คน
// แต่ละหมวด: เฉลี่ยคะแนนรายคาบ (คาบละส่วนเท่ากัน) แล้วแปลงเป็นสเกลตามน้ำหนักในตั้งค่า
export function computeStudentScore(
  items: ScoredItem[],
  entries: Map<string, ScoreEntry>,
  policy: ScoringPolicy,
  totalXp = 0,
): StudentScore {
  const categories: CategoryResult[] = CATEGORIES.map((category) => {
    const inCat = items.filter((i) => i.category === category)
    let raw = 0
    let max = 0
    let gradedMax = 0
    for (const item of inCat) {
      max += item.maxScore
      const eff = effectiveScore(item, entries.get(item.id), policy)
      if (eff != null) {
        raw += eff
        gradedMax += item.maxScore
      }
    }
    const weight = policy.weights[category]
    const s = sessionSlots(inCat, entries, policy)
    return {
      category,
      weight,
      raw: round2(raw),
      max,
      gradedMax,
      slots: s.count,
      scaled: round2(s.ratio * weight),
      gradedPct: s.gradedRatio == null ? null : s.gradedRatio * 100,
    }
  })

  if (policy.weights.affective > 0) {
    const full = Math.max(1, policy.affectiveFullXp)
    const ratio = Math.min(1, Math.max(0, totalXp) / full)
    categories.push({
      category: 'affective',
      weight: policy.weights.affective,
      raw: Math.max(0, totalXp),
      max: full,
      gradedMax: full,
      slots: 1,
      scaled: round2(ratio * policy.weights.affective),
      gradedPct: ratio * 100,
    })
  }

  const total = round2(categories.reduce((s, c) => s + c.scaled, 0))

  // คาดการณ์: ใช้สัดส่วนที่ทำได้ในคาบที่ตรวจแล้ว แล้วเฉลี่ยตามน้ำหนักของหมวดที่มีคะแนน
  let earned = 0
  let weightSeen = 0
  for (const c of categories) {
    if (c.gradedPct != null && c.weight > 0) {
      earned += (c.gradedPct / 100) * c.weight
      weightSeen += c.weight
    }
  }
  const weightAll = categories.reduce((s, c) => s + c.weight, 0)
  const predictedTotal = weightSeen > 0 && weightAll > 0 ? round2((earned / weightSeen) * weightAll) : null

  return {
    categories,
    total,
    grade: computeGrade(total, policy.gradeScale),
    predictedTotal,
    predictedGrade: predictedTotal == null ? null : computeGrade(predictedTotal, policy.gradeScale),
  }
}

// คะแนนที่ทำได้ตอนนี้ (0–100) ใช้กับวิวัฒนาการ: คิดเฉพาะคาบที่ครูเปิดแล้ว
//   ตรวจแล้ว = คะแนนจริง · ยังไม่ส่ง = 0 · ส่งแล้วรอตรวจ = ยังไม่นับ (ไม่ดึงคะแนนลง)
//   แต่ละหมวดเฉลี่ยรายคาบเหมือนคะแนนรวม แล้วเฉลี่ยตามน้ำหนักของหมวดที่มีคาบให้นับแล้ว
//   งานไม่ผูกคาบนับเมื่อมีคะแนนแล้วเท่านั้น · ยังไม่มีอะไรให้นับ = 0
export function computeSoFarScore(
  items: ScoredItem[],
  entries: Map<string, ScoreEntry>,
  policy: ScoringPolicy,
  openSessions: ReadonlySet<number>,
): number {
  let earned = 0
  let weightSeen = 0
  for (const category of CATEGORIES) {
    const weight = policy.weights[category]
    if (weight <= 0) continue
    const slots = new Map<string, { raw: number; max: number }>()
    for (const item of items) {
      if (item.category !== category || item.maxScore <= 0) continue
      const entry = entries.get(item.id)
      const eff = effectiveScore(item, entry, policy)
      const open = item.sessionNo == null ? eff != null : openSessions.has(item.sessionNo)
      if (!open) continue
      if (eff == null && entry?.submittedAt) continue // รอครูตรวจ
      const key = item.sessionNo != null ? `s${item.sessionNo}` : `i${item.id}`
      const slot = slots.get(key) ?? { raw: 0, max: 0 }
      slot.raw += eff ?? 0
      slot.max += item.maxScore
      slots.set(key, slot)
    }
    if (slots.size === 0) continue
    const ratio = [...slots.values()].reduce((s, x) => s + x.raw / x.max, 0) / slots.size
    earned += ratio * weight
    weightSeen += weight
  }
  return weightSeen > 0 ? round2((earned / weightSeen) * 100) : 0
}

// สำหรับ ปพ.5: คะแนนระหว่างภาค = ทุกอย่างยกเว้นปลายภาค
export function splitForPp5(score: StudentScore): { during: number; final: number } {
  const final = score.categories.find((c) => c.category === 'final')?.scaled ?? 0
  return { during: round2(score.total - final), final }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
