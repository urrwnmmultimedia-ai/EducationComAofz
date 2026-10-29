import { describe, expect, it } from 'vitest'
import type { StudentRow } from '@/lib/database.types'
import { bestByGame, sortSummaries, stepCount, summarize } from './studentProgress'

const student = (id: string, room: string | null, number: number | null): StudentRow => ({
  id,
  student_code: `1000${id}`,
  prefix: '',
  first_name: id,
  last_name: '',
  nickname: '',
  classroom_id: room,
  number,
  avatar: 'non',
  is_active: true,
  bound_auth_uid: null,
  bound_device_key: null,
  created_at: '2026-01-01T00:00:00Z',
})

describe('ความคืบหน้านักเรียน ม.3', () => {
  it('นับขั้นของคาบอย่างน้อย 1', () => {
    expect(stepCount({ steps: [] })).toBe(1)
    expect(stepCount({ steps: ['a', 'b', 'c'] })).toBe(3)
    expect(stepCount({ steps: null })).toBe(1)
  })

  it('สรุป XP คาบที่ครบ คาบล่าสุด เหรียญ และใช้งานล่าสุด', () => {
    const [a, b] = summarize({
      students: [student('a', 'r1', 1), student('b', null, null)],
      rooms: [{ id: 'r1', name: 'ม.3/1' }],
      sessions: [
        { session_no: 1, steps: ['warmup', 'content'] },
        { session_no: 2, steps: ['warmup', 'content', 'exit'] },
      ],
      progress: [
        { student_id: 'a', session_no: 1, completed_steps: ['warmup', 'content'], updated_at: '2026-10-01T08:00:00Z' },
        { student_id: 'a', session_no: 2, completed_steps: ['warmup'], updated_at: '2026-10-08T08:00:00Z' },
        // คาบที่ถูกลบไปแล้วไม่นับ
        { student_id: 'a', session_no: 9, completed_steps: ['warmup'], updated_at: '2026-10-20T08:00:00Z' },
      ],
      xp: [
        { student_id: 'a', xp: 10 },
        { student_id: 'a', xp: 5 },
      ],
      badges: [{ student_id: 'a' }],
      logins: [
        { student_id: 'a', last_seen_at: '2026-10-05T08:00:00Z' },
        { student_id: null, last_seen_at: '2026-10-30T08:00:00Z' },
      ],
    })
    expect(a).toMatchObject({ roomName: 'ม.3/1', xp: 15, sessionsDone: 1, currentSession: 2, badges: 1, lastActive: '2026-10-08T08:00:00Z' })
    expect(b).toMatchObject({ roomName: '-', xp: 0, sessionsDone: 0, currentSession: null, badges: 0, lastActive: null })
  })

  it('เรียงตามห้องแล้วเลขที่', () => {
    const rows = summarize({
      students: [student('c', 'r2', 1), student('b', 'r1', 2), student('a', 'r1', 1)],
      rooms: [
        { id: 'r1', name: 'ม.3/1' },
        { id: 'r2', name: 'ม.3/2' },
      ],
      sessions: [],
      progress: [],
      xp: [],
      badges: [],
      logins: [],
    })
    expect(sortSummaries(rows).map((r) => r.student.id)).toEqual(['a', 'b', 'c'])
  })

  it('คะแนนเกมดีที่สุดต่อเกม', () => {
    const games = [
      { id: 'g1', title: 'เกม ข', max_score: 100 },
      { id: 'g2', title: 'เกม ก', max_score: 50 },
    ]
    const plays = [
      { game_id: 'g1', score: 40 },
      { game_id: 'g1', score: 80 },
      { game_id: 'g2', score: 30 },
    ]
    expect(bestByGame(plays, games)).toEqual([
      { gameId: 'g2', title: 'เกม ก', bestScore: 30, maxScore: 50, plays: 1 },
      { gameId: 'g1', title: 'เกม ข', bestScore: 80, maxScore: 100, plays: 2 },
    ])
  })
})
