import { scoreEvolutionOf, withGradeBands, type ScoreEvo, type ScoreStage } from '@/components/evolution/scoreEvolution'

// วิวัฒนาการของ ม.3: จาก "ลิงน้อย" สู่ "มนุษย์นักเทคโนโลยี" ตามคะแนนรวมในสมุดคะแนน (0–100)
// 8 ขั้น = ระดับผลการเรียน 0, 1, 1.5, 2, 2.5, 3, 3.5, 4

export const M3_STAGES: ScoreStage[] = withGradeBands([
  { name: 'ลิงน้อย', tagline: 'เพิ่งเริ่มต้นการเดินทาง' },
  { name: 'ลิงช่างสงสัย', tagline: 'เริ่มตั้งคำถามกับเทคโนโลยีรอบตัว' },
  { name: 'วานรยืนสองขา', tagline: 'ลุกขึ้นยืน พร้อมเรียนรู้ทุกคาบ' },
  { name: 'มนุษย์ถ้ำ', tagline: 'รู้จักใช้เครื่องมือแก้ปัญหา' },
  { name: 'มนุษย์นักเพาะปลูก', tagline: 'วางแผนและลงมือทำทีละขั้น' },
  { name: 'มนุษย์นักประดิษฐ์', tagline: 'ออกแบบและสร้างสิ่งใหม่ได้' },
  { name: 'มนุษย์นักออกแบบ', tagline: 'คิดไอเดียแล้วร่างแบบให้คนอื่นเข้าใจ' },
  { name: 'มนุษย์นักเทคโนโลยี', tagline: 'ใช้เทคโนโลยีอย่างเข้าใจและสร้างสรรค์' },
])

export const m3EvolutionOf = (score: number): ScoreEvo => scoreEvolutionOf(score, M3_STAGES)
