import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { BadgeRow, GameRow, LeaderboardRow, MyGameItem } from '@/lib/database.types'
import type { SubmitResult } from '@/games/shared/GameShell'

const submitSchema = z.object({
  xp: z.number(),
  first_play: z.boolean(),
  plays_today: z.number(),
  daily_limit: z.number(),
  capped: z.boolean(),
  best_score: z.number().nullable(),
  new_badges: z.array(z.object({ code: z.string(), name: z.string(), icon: z.string() })),
})

export async function fetchMyGames(): Promise<MyGameItem[]> {
  const { data, error } = await supabase.rpc('my_games')
  if (error) throw error
  return data
}

export async function fetchGame(slug: string): Promise<GameRow | null> {
  const { data, error } = await supabase.from('games').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
}

export async function submitGameResult(slug: string, score: number, durationSec: number): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_game_result', { p_slug: slug, p_score: score, p_duration_sec: durationSec })
  if (error) throw new Error(error.message)
  return submitSchema.parse(data)
}

export async function fetchLeaderboard(scope: 'class' | 'all', classroomId?: string | null): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('leaderboard', { p_scope: scope, p_classroom_id: classroomId ?? null })
  if (error) throw error
  return data
}

// เรียก cb เมื่อ XP ในระบบเปลี่ยน (Realtime) — คืนฟังก์ชันยกเลิก
export function onLeaderboardChange(cb: () => void): () => void {
  const channel = supabase
    .channel('leaderboard-ticks')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leaderboard_ticks' }, cb)
    .subscribe()
  return () => void supabase.removeChannel(channel)
}

export async function fetchMyBadges(studentId: string): Promise<{ all: BadgeRow[]; earned: Map<string, string> }> {
  const [all, mine] = await Promise.all([
    supabase.from('badges').select('*').order('code'),
    supabase.from('student_badges').select('badge_id, earned_at').eq('student_id', studentId),
  ])
  if (all.error) throw all.error
  if (mine.error) throw mine.error
  return { all: all.data, earned: new Map(mine.data.map((b) => [b.badge_id, b.earned_at])) }
}

export async function setMyAvatar(avatar: string): Promise<void> {
  const { error } = await supabase.rpc('set_my_avatar', { p_avatar: avatar })
  if (error) throw error
}
