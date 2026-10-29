import { scoreEvolutionOf, STAGE_SCORES, type ScoreEvo, type ScoreStage } from '@/components/evolution/scoreEvolution'

// วิวัฒนาการของ DB Quest (ม.5): จาก "เจ้าทุยน้อย" (ควายไทย) สู่ "มนุษย์ฐานข้อมูล" ตามคะแนนสะสม 0–100 (เกณฑ์ขั้นเดียวกับ ม.3)

const DBQ_NAMES: Omit<ScoreStage, 'minScore'>[] = [
  { name: 'เจ้าทุยน้อย', tagline: 'เพิ่งก้าวเข้าโลกข้อมูล' },
  { name: 'ทุยช่างสงสัย', tagline: 'เริ่มตั้งคำถามกับข้อมูลรอบตัว' },
  { name: 'ทุยหัดอ่าน', tagline: 'อ่านตารางและศัพท์ฐานข้อมูลออก' },
  { name: 'ทุยยืนสองขา', tagline: 'ออกแบบตารางและความสัมพันธ์เองได้' },
  { name: 'ครึ่งทุยครึ่งคน', tagline: 'จัดระเบียบข้อมูลและเริ่มเขียน SQL' },
  { name: 'มนุษย์ฐานข้อมูล', tagline: 'สร้างและดูแลฐานข้อมูลได้ครบวงจร' },
]

export const EVO_STAGES: ScoreStage[] = DBQ_NAMES.map((s, i) => ({ ...s, minScore: STAGE_SCORES[i] ?? 100 }))

export const evolutionOf = (score: number): ScoreEvo => scoreEvolutionOf(score, EVO_STAGES)
