import { z } from 'zod'
import { supabase } from '@/lib/supabase'

// ชื่อเกมจริง (จากสำรับบนเซิร์ฟเวอร์) — game_key -> title
export type GameTitles = Record<string, string>

// โหลดไม่ได้ (เช่น ฐานข้อมูลยังไม่ได้อัปเดต) => คืน {} แล้วแสดงรหัสเกมแทน ไม่ให้ทั้งหน้าล้ม
export async function fetchGameTitles(): Promise<GameTitles> {
  const { data, error } = await supabase.rpc('dbq_game_titles')
  if (error) {
    console.warn('dbq_game_titles', error.message)
    return {}
  }
  const parsed = z.record(z.string(), z.string()).safeParse(data)
  return parsed.success ? parsed.data : {}
}

export function gameTitle(titles: GameTitles | undefined, key: string): string {
  return titles?.[key] ?? key
}
