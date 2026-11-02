import { scoreEvolutionOf, withGradeBands, type ScoreEvo, type ScoreStage } from '@/components/evolution/scoreEvolution'

// วิวัฒนาการของ DB Quest (ม.5): จาก "เจ้าทุยน้อย" (ควายไทย) สู่ "มนุษย์ฐานข้อมูล" ตามคะแนนสะสม 0–100 (เกณฑ์ขั้นเดียวกับ ม.3)

// 8 ขั้น = ระดับผลการเรียน 0, 1, 1.5, 2, 2.5, 3, 3.5, 4
export const EVO_STAGES: ScoreStage[] = withGradeBands([
  { name: 'เจ้าทุยน้อย', tagline: 'เพิ่งก้าวเข้าโลกข้อมูล' },
  { name: 'ทุยช่างสงสัย', tagline: 'เริ่มตั้งคำถามกับข้อมูลรอบตัว' },
  { name: 'ทุยหัดอ่าน', tagline: 'อ่านตารางและศัพท์ฐานข้อมูลออก' },
  { name: 'ทุยนักจดบันทึก', tagline: 'เก็บข้อมูลลงตารางเป็นระเบียบ' },
  { name: 'ทุยยืนสองขา', tagline: 'ออกแบบตารางและความสัมพันธ์เองได้' },
  { name: 'ทุยถือกุญแจ', tagline: 'เลือกคีย์หลักและคีย์นอกได้ถูกต้อง' },
  { name: 'ครึ่งทุยครึ่งคน', tagline: 'จัดระเบียบข้อมูลและเริ่มเขียน SQL' },
  { name: 'มนุษย์ฐานข้อมูล', tagline: 'สร้างและดูแลฐานข้อมูลได้ครบวงจร' },
])

export const evolutionOf = (score: number): ScoreEvo => scoreEvolutionOf(score, EVO_STAGES)
