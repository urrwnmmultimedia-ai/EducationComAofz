// วิวัฒนาการตามคะแนนรวม 0–100 (ใช้ทั้ง ม.3 ลิง → คน และ ม.5 ควาย → คน)

export interface ScoreStage {
  name: string
  tagline: string
  minScore: number
}

export interface ScoreEvo {
  index: number
  stage: ScoreStage
  next: ScoreStage | null
  toNext: number // คะแนนที่ยังขาดถึงขั้นถัดไป (0 = ขั้นสุดท้าย)
  progress: number // 0–1 ภายในช่วงขั้นปัจจุบัน → ขั้นถัดไป
}

// เกณฑ์ขั้นเดียวกันทั้งสองวิชา
export const STAGE_SCORES = [0, 15, 30, 50, 70, 85] as const

export function scoreEvolutionOf(score: number, stages: ScoreStage[]): ScoreEvo {
  const s = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0))
  let index = 0
  stages.forEach((st, i) => {
    if (s >= st.minScore) index = i
  })
  const stage = stages[index] as ScoreStage
  const next = stages[index + 1] ?? null
  if (!next) return { index, stage, next, toNext: 0, progress: 1 }
  const span = next.minScore - stage.minScore
  return {
    index,
    stage,
    next,
    toNext: Math.round((next.minScore - s) * 100) / 100,
    progress: span <= 0 ? 1 : Math.max(0, Math.min(1, (s - stage.minScore) / span)),
  }
}
