import type { Sfx } from './sfx'

export interface Mistake {
  prompt: string
  yours: string
  correct: string
  explain?: string
}

// ผลจากเกม 1 รอบ (score แปลงเป็น 0–100 ใน GameShell)
export interface GameOutcome {
  correct: number
  total: number
  mistakes: Mistake[]
  // บางเกมคิดคะแนนเองเป็น 0–100 (เช่น ร้านเพิ่มมูลค่า)
  scoreOverride?: number
}

export interface GameProps<C> {
  config: C
  onFinish: (outcome: GameOutcome) => void
  sfx: Sfx
}

export function toScore(o: GameOutcome): number {
  if (o.scoreOverride != null) return Math.max(0, Math.min(100, Math.round(o.scoreOverride)))
  if (o.total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((o.correct / o.total) * 100)))
}
