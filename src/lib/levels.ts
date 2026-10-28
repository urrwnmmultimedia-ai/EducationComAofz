export const XP_PER_LEVEL = 200

export const LEVEL_NAMES = ['นักสำรวจ', 'นักคิด', 'นักออกแบบ', 'นักประดิษฐ์', 'วิศวกรน้อย', 'นวัตกร'] as const

export interface LevelInfo {
  level: number
  name: string
  xpInLevel: number
  xpToNext: number
  progress: number // 0–1
}

// ทุก 200 XP ขึ้น 1 เลเวล; ชื่อเลเวลสุดท้าย (นวัตกร) ใช้ต่อไปเรื่อย ๆ
export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0))
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp % XP_PER_LEVEL
  const name = LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? LEVEL_NAMES[0]
  return {
    level,
    name,
    xpInLevel,
    xpToNext: XP_PER_LEVEL - xpInLevel,
    progress: xpInLevel / XP_PER_LEVEL,
  }
}
