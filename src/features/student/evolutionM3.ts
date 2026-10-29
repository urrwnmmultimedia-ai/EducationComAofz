import { scoreEvolutionOf, STAGE_SCORES, type ScoreEvo, type ScoreStage } from '@/components/evolution/scoreEvolution'

// วิวัฒนาการของ ม.3: จาก "ลิงน้อย" สู่ "มนุษย์นักเทคโนโลยี" ตามคะแนนรวมในสมุดคะแนน (0–100)

const M3_NAMES: Omit<ScoreStage, 'minScore'>[] = [
  { name: 'ลิงน้อย', tagline: 'เพิ่งเริ่มต้นการเดินทาง' },
  { name: 'ลิงช่างสงสัย', tagline: 'เริ่มตั้งคำถามกับเทคโนโลยีรอบตัว' },
  { name: 'วานรยืนสองขา', tagline: 'ลุกขึ้นยืน พร้อมเรียนรู้ทุกคาบ' },
  { name: 'มนุษย์ถ้ำ', tagline: 'รู้จักใช้เครื่องมือแก้ปัญหา' },
  { name: 'มนุษย์นักประดิษฐ์', tagline: 'ออกแบบและสร้างสิ่งใหม่ได้' },
  { name: 'มนุษย์นักเทคโนโลยี', tagline: 'ใช้เทคโนโลยีอย่างเข้าใจและสร้างสรรค์' },
]

export const M3_STAGES: ScoreStage[] = M3_NAMES.map((s, i) => ({ ...s, minScore: STAGE_SCORES[i] ?? 100 }))

export const m3EvolutionOf = (score: number): ScoreEvo => scoreEvolutionOf(score, M3_STAGES)
