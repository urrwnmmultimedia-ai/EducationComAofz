import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { scoresSchema } from '../admin/dbqAdminApi'

// คะแนน/งาน/อันดับของนักเรียนเอง (เซิร์ฟเวอร์คำนวณ)

const num = z.coerce.number()

const myScoresSchema = z.discriminatedUnion('preview', [
  z.object({ preview: z.literal(true) }),
  z.object({
    preview: z.literal(false),
    scores: scoresSchema,
    assignments: z.array(
      z.object({
        item_id: z.string(),
        title: z.string(),
        session_no: z.number().nullable(),
        max_score: num,
        open: z.boolean(),
        status: z.enum(['missing', 'submitted', 'graded']),
        score: num.nullable(),
        feedback: z.string().nullable(),
        submitted_at: z.string().nullable(),
        graded_at: z.string().nullable(),
      }),
    ),
    games: z.array(
      z.object({ game_key: z.string(), session_no: z.number(), best_score: num.nullable(), best_stars: num.nullable(), plays: num }),
    ),
  }),
])
export type MyScores = z.infer<typeof myScoresSchema>

const meSchema = z.object({
  xp: num,
  badges: z.array(z.object({ key: z.string(), name: z.string(), icon: z.string(), earned_at: z.string() })),
})

const leaderboardSchema = z.object({
  enabled: z.boolean(),
  rows: z.array(z.object({ rank: num, nickname: z.string(), avatar: z.string(), xp: num, is_me: z.boolean() })),
})
export type Leaderboard = z.infer<typeof leaderboardSchema>

async function rpc(fn: 'dbq_my_scores' | 'dbq_me' | 'dbq_leaderboard'): Promise<unknown> {
  const { data, error } = await supabase.rpc(fn)
  if (error) throw new Error(error.message)
  return data
}

export const fetchMyScores = async () => myScoresSchema.parse(await rpc('dbq_my_scores'))
export const fetchMe = async () => meSchema.parse(await rpc('dbq_me'))
export const fetchLeaderboard = async () => leaderboardSchema.parse(await rpc('dbq_leaderboard'))
