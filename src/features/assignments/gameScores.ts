import { supabase } from '@/lib/supabase'
import type { ScoreEntry, ScoredItem } from '@/lib/scoring'

// เกมประจำคาบของ ม.3 ในสมุดคะแนน: คาบที่มีเกม = 1 ช่องในหมวด "เกม" (คาบละส่วนเท่ากัน)
//   คะแนนช่อง = คะแนนเกมดีที่สุดของนักเรียน / คะแนนเต็มของเกม · ยังไม่เล่น = 0

export interface GameSession {
  sessionNo: number
  maxScore: number
}

export interface GameBest {
  studentId: string
  sessionNo: number
  best: number
}

export interface GameScores {
  sessions: GameSession[]
  best: GameBest[]
}

export const EMPTY_GAME_SCORES: GameScores = { sessions: [], best: [] }

const gameItemId = (sessionNo: number) => `game:s${sessionNo}`

export function gameItems(games: GameScores): ScoredItem[] {
  return games.sessions.map((g) => ({ id: gameItemId(g.sessionNo), category: 'game', maxScore: g.maxScore, dueAt: null, sessionNo: g.sessionNo }))
}

// เพิ่มคะแนนเกมของนักเรียนคนนี้ลงในรายการคะแนน (ไม่แก้ map เดิม)
export function withGameEntries(studentId: string, entries: Map<string, ScoreEntry>, games: GameScores): Map<string, ScoreEntry> {
  const out = new Map(entries)
  const inCourse = new Set(games.sessions.map((g) => g.sessionNo))
  for (const b of games.best) {
    if (b.studentId !== studentId || !inCourse.has(b.sessionNo)) continue
    out.set(gameItemId(b.sessionNo), { score: b.best, submittedAt: null })
  }
  return out
}

// คาบที่มีเกม (เกมที่เปิดใช้) + คะแนนดีที่สุดรายคาบ
//   นักเรียนได้เฉพาะของตัวเอง · ครูได้ทุกคน (RPC m3_game_best)
//   ยังไม่ได้รันอัปเดต SQL: นักเรียนอ่าน game_plays ของตัวเองแทน ครูได้ตามที่อ่านได้
export async function fetchGameScores(studentId?: string): Promise<GameScores> {
  const [cs, games] = await Promise.all([
    supabase.from('class_sessions').select('session_no, game_slug').not('game_slug', 'is', null),
    supabase.from('games').select('id, slug, max_score, is_active'),
  ])
  if (cs.error) throw cs.error
  if (games.error) throw games.error
  const bySlug = new Map(games.data.filter((g) => g.is_active).map((g) => [g.slug, g]))
  const sessionOfGame = new Map<string, number>()
  const sessions: GameSession[] = []
  for (const s of cs.data) {
    const g = s.game_slug ? bySlug.get(s.game_slug) : undefined
    if (!g) continue
    sessions.push({ sessionNo: s.session_no, maxScore: Number(g.max_score) })
    if (!sessionOfGame.has(g.id)) sessionOfGame.set(g.id, s.session_no)
  }
  sessions.sort((a, b) => a.sessionNo - b.sessionNo)

  const rpc = await supabase.rpc('m3_game_best')
  if (!rpc.error) {
    const best = rpc.data
      .filter((r) => !studentId || r.student_id === studentId)
      .map((r) => ({ studentId: r.student_id, sessionNo: r.session_no, best: Number(r.best) }))
    return { sessions, best }
  }

  let q = supabase.from('game_plays').select('student_id, game_id, score')
  if (studentId) q = q.eq('student_id', studentId)
  const plays = await q
  if (plays.error) throw plays.error
  const top = new Map<string, GameBest>()
  for (const p of plays.data) {
    const sessionNo = sessionOfGame.get(p.game_id)
    if (sessionNo == null) continue
    const key = `${p.student_id}:${sessionNo}`
    const cur = top.get(key)
    if (!cur || p.score > cur.best) top.set(key, { studentId: p.student_id, sessionNo, best: p.score })
  }
  return { sessions, best: [...top.values()] }
}
