// เลเวลของ DB Quest: วิวัฒนาการจาก "เจ้าทุยน้อย" (ควายไทย) สู่ "มนุษย์ฐานข้อมูล"
// ขึ้นขั้นได้เมื่อผ่าน "ทั้ง" XP และจำนวนคาบเนื้อหาที่เรียนครบ 100% (เก็บ XP อย่างเดียวไม่พอ ต้องเรียนจริง)
// XP ต่อคาบโดยประมาณ ~150 (ขั้นในคาบ + ตอบถูก + โบนัสจบคาบ + เกม + ใบงาน)

export interface EvoStage {
  name: string
  tagline: string
  minXp: number
  minSessions: number
}

export const EVO_STAGES: EvoStage[] = [
  { name: 'เจ้าทุยน้อย', tagline: 'เพิ่งก้าวเข้าโลกข้อมูล', minXp: 0, minSessions: 0 },
  { name: 'ทุยช่างสงสัย', tagline: 'เริ่มตั้งคำถามกับข้อมูลรอบตัว', minXp: 100, minSessions: 1 },
  { name: 'ทุยหัดอ่าน', tagline: 'อ่านตารางและศัพท์ฐานข้อมูลออก', minXp: 400, minSessions: 3 },
  { name: 'ทุยยืนสองขา', tagline: 'ออกแบบตารางและความสัมพันธ์เองได้', minXp: 850, minSessions: 6 },
  { name: 'ครึ่งทุยครึ่งคน', tagline: 'จัดระเบียบข้อมูลและเริ่มเขียน SQL', minXp: 1500, minSessions: 10 },
  { name: 'มนุษย์ฐานข้อมูล', tagline: 'สร้างและดูแลฐานข้อมูลได้ครบวงจร', minXp: 2200, minSessions: 14 },
]

export interface EvoInfo {
  index: number
  stage: EvoStage
  next: EvoStage | null
  xpToNext: number // 0 = ผ่านเงื่อนไข XP ของขั้นถัดไปแล้ว
  sessionsToNext: number // 0 = ผ่านเงื่อนไขจำนวนคาบแล้ว
  xpProgress: number // 0–1 ภายในช่วงขั้นปัจจุบัน → ขั้นถัดไป
  sessionProgress: number // 0–1
}

export function evolutionOf(xp: number, sessionsDone: number, stages: EvoStage[] = EVO_STAGES): EvoInfo {
  const x = Math.max(0, Number.isFinite(xp) ? xp : 0)
  const s = Math.max(0, Math.floor(sessionsDone))
  let index = 0
  for (let i = stages.length - 1; i >= 0; i--) {
    const st = stages[i]
    if (st && x >= st.minXp && s >= st.minSessions) {
      index = i
      break
    }
  }
  const stage = stages[index] as EvoStage
  const next = stages[index + 1] ?? null
  if (!next) return { index, stage, next, xpToNext: 0, sessionsToNext: 0, xpProgress: 1, sessionProgress: 1 }
  const ratio = (v: number, lo: number, hi: number) => (hi <= lo ? 1 : Math.max(0, Math.min(1, (v - lo) / (hi - lo))))
  return {
    index,
    stage,
    next,
    xpToNext: Math.max(0, next.minXp - x),
    sessionsToNext: Math.max(0, next.minSessions - s),
    xpProgress: ratio(x, stage.minXp, next.minXp),
    sessionProgress: ratio(s, stage.minSessions, next.minSessions),
  }
}
