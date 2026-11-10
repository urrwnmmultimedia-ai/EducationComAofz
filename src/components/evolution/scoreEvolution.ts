// วิวัฒนาการตามคะแนนรวม 0–100 (ใช้ทั้ง ม.3 ลิง → คน และ ม.5 ควาย → คน)

export interface ScoreStage {
  name: string
  tagline: string
  minScore: number
  grade: string // ระดับผลการเรียนที่ตรงกับขั้นนี้ เช่น "3.5"
  gradeLabel: string // ความหมาย เช่น "ดีมาก"
  art: number // ภาพลำดับที่เท่าไรในชุดภาพของวิชา (= ลำดับในรายการทั้งหมด รวมขั้นย่อย)
  main: number // ขั้นหลัก 0–7 (= เกรด 0–4)
  minor: number // 0 = ขั้นหลัก · 1–4 = วิวัฒนาการย่อยก่อนผ่านเกณฑ์ (10/20/30/40)
}

export interface ScoreEvo {
  index: number // ลำดับในรายการทั้งหมด (รวมขั้นย่อย)
  main: number // ขั้นหลัก 0–7 (= เกรด 0–4)
  stage: ScoreStage
  next: ScoreStage | null
  toNext: number // คะแนนที่ยังขาดถึงขั้นถัดไป (0 = ขั้นสุดท้าย)
  progress: number // 0–1 ภายในช่วงขั้นปัจจุบัน → ขั้นถัดไป
}

// เกณฑ์ขั้นเดียวกันทั้งสองวิชา = ระดับผลการเรียน 8 ระดับ (0–4) ตามหลักสูตรแกนกลางฯ
export const GRADE_BANDS = [
  { minScore: 0, grade: '0', gradeLabel: 'ต่ำกว่าเกณฑ์' },
  { minScore: 50, grade: '1', gradeLabel: 'ผ่านเกณฑ์ขั้นต่ำ' },
  { minScore: 55, grade: '1.5', gradeLabel: 'พอใช้' },
  { minScore: 60, grade: '2', gradeLabel: 'ปานกลาง' },
  { minScore: 65, grade: '2.5', gradeLabel: 'ค่อนข้างดี' },
  { minScore: 70, grade: '3', gradeLabel: 'ดี' },
  { minScore: 75, grade: '3.5', gradeLabel: 'ดีมาก' },
  { minScore: 80, grade: '4', gradeLabel: 'ดีเยี่ยม' },
] as const

// วิวัฒนาการย่อยช่วงก่อนผ่านเกณฑ์ (เกรด 0): ทุก 10 คะแนน ให้เห็นว่าโตขึ้นเรื่อย ๆ
export const MINOR_STEPS = [10, 20, 30, 40] as const

type Named = { name: string; tagline: string }

// รวมชื่อ/คำโปรยของแต่ละวิชาเข้ากับเกณฑ์ (8 ขั้นหลัก + 4 ขั้นย่อยแทรกหลังขั้นแรก)
export function withGradeBands(names: Named[], minors: Named[] = []): ScoreStage[] {
  if (names.length !== GRADE_BANDS.length) throw new Error(`evolution needs ${GRADE_BANDS.length} stages`)
  if (minors.length && minors.length !== MINOR_STEPS.length) throw new Error(`evolution needs ${MINOR_STEPS.length} minor stages`)
  const main = names.map((n, i): Omit<ScoreStage, 'art'> => ({ ...n, ...GRADE_BANDS[i]!, main: i, minor: 0 }))
  const sub = minors.map((n, k): Omit<ScoreStage, 'art'> => ({ ...n, ...GRADE_BANDS[0], minScore: MINOR_STEPS[k]!, main: 0, minor: k + 1 }))
  return [main[0]!, ...sub, ...main.slice(1)].map((st, i) => ({ ...st, art: i }))
}

export function scoreEvolutionOf(score: number, stages: ScoreStage[]): ScoreEvo {
  const s = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0))
  let index = 0
  stages.forEach((st, i) => {
    if (s >= st.minScore) index = i
  })
  const stage = stages[index] as ScoreStage
  const next = stages[index + 1] ?? null
  if (!next) return { index, main: stage.main, stage, next, toNext: 0, progress: 1 }
  const span = next.minScore - stage.minScore
  return {
    index,
    main: stage.main,
    stage,
    next,
    toNext: Math.round((next.minScore - s) * 100) / 100,
    progress: span <= 0 ? 1 : Math.max(0, Math.min(1, (s - stage.minScore) / span)),
  }
}
