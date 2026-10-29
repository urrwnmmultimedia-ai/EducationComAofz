import type {
  AttendanceRow,
  BadgeRow,
  ClassSessionRow,
  ClassroomRow,
  GamePlayRow,
  GameRow,
  SessionProgressRow,
  SessionRow,
  StudentBadgeRow,
  StudentRow,
  XpEventRow,
} from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { buildGradebook, fetchSettings, policyFromSettings } from '@/features/assignments/gradebookData'
import { M3, roomsOf, studentsIn } from './courseScope'

// ความคืบหน้านักเรียน ม.3 (หน้าครู /admin/progress) — แบบเดียวกับหน้า "ความคืบหน้านักเรียน" ของ DB Quest
// ครูอ่านทุกตารางได้ตาม RLS จึงรวมผลฝั่งหน้าเว็บ ไม่ต้องมี RPC ใหม่

type StepRow = SessionProgressRow

export interface StudentSummary {
  student: StudentRow
  roomName: string
  xp: number
  sessionsDone: number
  currentSession: number | null
  badges: number
  lastActive: string | null
}

const later = (a: string | null, b: string | null | undefined) => (!b ? a : !a || b > a ? b : a)

// จำนวนขั้นของคาบ (นับแบบเดียวกับ my_session_list: อย่างน้อย 1)
export function stepCount(s: Pick<ClassSessionRow, 'steps'>): number {
  return Math.max(Array.isArray(s.steps) ? s.steps.length : 0, 1)
}

export function summarize(input: {
  students: StudentRow[]
  rooms: Pick<ClassroomRow, 'id' | 'name'>[]
  sessions: Pick<ClassSessionRow, 'session_no' | 'steps'>[]
  progress: StepRow[]
  xp: Pick<XpEventRow, 'student_id' | 'xp'>[]
  badges: Pick<StudentBadgeRow, 'student_id'>[]
  logins: Pick<SessionRow, 'student_id' | 'last_seen_at'>[]
}): StudentSummary[] {
  const roomName = new Map(input.rooms.map((r) => [r.id, r.name]))
  const total = new Map(input.sessions.map((s) => [s.session_no, stepCount(s)]))
  const by = <T extends { student_id: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>()
    for (const r of rows) if (r.student_id) m.set(r.student_id, [...(m.get(r.student_id) ?? []), r])
    return m
  }
  const progress = by(input.progress)
  const xp = by(input.xp)
  const badges = by(input.badges)
  const logins = by(input.logins)

  return input.students.map((student) => {
    const steps = (progress.get(student.id) ?? []).filter((p) => total.has(p.session_no))
    const started = steps.filter((p) => p.completed_steps.length > 0)
    let lastActive: string | null = null
    for (const p of started) lastActive = later(lastActive, p.updated_at)
    for (const l of logins.get(student.id) ?? []) lastActive = later(lastActive, l.last_seen_at)
    return {
      student,
      roomName: student.classroom_id ? (roomName.get(student.classroom_id) ?? '-') : '-',
      xp: (xp.get(student.id) ?? []).reduce((a, e) => a + e.xp, 0),
      sessionsDone: steps.filter((p) => p.completed_steps.length >= (total.get(p.session_no) ?? 1)).length,
      currentSession: started.length ? Math.max(...started.map((p) => p.session_no)) : null,
      badges: (badges.get(student.id) ?? []).length,
      lastActive,
    }
  })
}

export function sortSummaries(rows: StudentSummary[]): StudentSummary[] {
  return [...rows].sort(
    (a, b) => a.roomName.localeCompare(b.roomName, 'th') || (a.student.number ?? 99) - (b.student.number ?? 99) || a.student.student_code.localeCompare(b.student.student_code),
  )
}

export const XP_SOURCE_LABEL: Record<XpEventRow['source'], string> = {
  game: 'เล่นเกม',
  assignment: 'ส่งงาน',
  exit_ticket: 'แบบทดสอบท้ายคาบ',
  attendance: 'เข้าเรียน',
  badge: 'ได้เหรียญ',
  manual: 'ครูให้เพิ่ม',
}

export interface GameBest {
  gameId: string
  title: string
  bestScore: number
  maxScore: number
  plays: number
}

export function bestByGame(plays: Pick<GamePlayRow, 'game_id' | 'score'>[], games: Pick<GameRow, 'id' | 'title' | 'max_score'>[]): GameBest[] {
  const info = new Map(games.map((g) => [g.id, g]))
  const m = new Map<string, GameBest>()
  for (const p of plays) {
    const g = info.get(p.game_id)
    const cur = m.get(p.game_id) ?? { gameId: p.game_id, title: g?.title ?? 'เกม', bestScore: 0, maxScore: g?.max_score ?? 100, plays: 0 }
    m.set(p.game_id, { ...cur, bestScore: Math.max(cur.bestScore, p.score), plays: cur.plays + 1 })
  }
  return [...m.values()].sort((a, b) => a.title.localeCompare(b.title, 'th'))
}

// ---------- โหลดข้อมูล ----------

// Supabase คืนได้ครั้งละ 1000 แถว: ตารางที่โตเร็ว (XP ความคืบหน้า) ดึงเป็นหน้า ๆ จนครบ
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

function must<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error
  return r.data as T
}

async function fetchRoomsAndStudents() {
  const [c, s] = await Promise.all([
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
    supabase.from('students').select('*').order('student_code'),
  ])
  const rooms = roomsOf(must(c), M3)
  return { rooms, students: studentsIn(must(s), rooms, M3) }
}

export async function fetchProgressList(roomId: string | null) {
  const { rooms, students: everyone } = await fetchRoomsAndStudents()
  const students = roomId ? everyone.filter((s) => s.classroom_id === roomId) : everyone
  const [sessions, progress, xp, badges, logins] = await Promise.all([
    supabase.from('class_sessions').select('session_no, steps').order('session_no').then(must),
    all<StepRow>((a, b) => supabase.from('session_progress').select('student_id, session_no, completed_steps, updated_at').range(a, b)),
    all<Pick<XpEventRow, 'student_id' | 'xp'>>((a, b) => supabase.from('xp_events').select('student_id, xp').range(a, b)),
    all<Pick<StudentBadgeRow, 'student_id'>>((a, b) => supabase.from('student_badges').select('student_id').range(a, b)),
    all<Pick<SessionRow, 'student_id' | 'last_seen_at'>>((a, b) =>
      supabase.from('sessions').select('student_id, last_seen_at').eq('role', 'student').range(a, b),
    ),
  ])
  return { rooms, rows: sortSummaries(summarize({ students, rooms, sessions, progress, xp, badges, logins })) }
}

export interface SessionProgress {
  session_no: number
  title: string
  done: number
  total: number
  open: boolean
}

export async function fetchStudentProgress(id: string) {
  const student = must(await supabase.from('students').select('*').eq('id', id).single()) as StudentRow
  const [room, sessions, unlocks, progress, xp, plays, games, myBadges, badges, attendance, assignments, subs, settings] = await Promise.all([
    student.classroom_id ? supabase.from('classrooms').select('*').eq('id', student.classroom_id).maybeSingle().then(must) : null,
    supabase.from('class_sessions').select('session_no, title, steps').order('session_no').then(must),
    student.classroom_id
      ? supabase.from('classroom_session_unlocks').select('session_no, is_unlocked').eq('classroom_id', student.classroom_id).then(must)
      : [],
    supabase.from('session_progress').select('session_no, completed_steps, updated_at').eq('student_id', id).then(must),
    supabase.from('xp_events').select('*').eq('student_id', id).order('created_at', { ascending: false }).then(must),
    supabase.from('game_plays').select('game_id, score').eq('student_id', id).then(must),
    supabase.from('games').select('id, title, max_score').then(must),
    supabase.from('student_badges').select('*').eq('student_id', id).then(must),
    supabase.from('badges').select('*').then(must),
    supabase.from('attendance').select('*').eq('student_id', id).then(must),
    supabase.from('assignments').select('*').then(must),
    supabase.from('submissions').select('*').eq('student_id', id).then(must),
    fetchSettings(),
  ])
  const open = new Set((unlocks ?? []).filter((u) => u.is_unlocked).map((u) => u.session_no))
  const done = new Map((progress ?? []).map((p) => [p.session_no, p.completed_steps.length]))
  const badgeInfo = new Map((badges as BadgeRow[]).map((b) => [b.id, b]))
  const totalXp = (xp as XpEventRow[]).reduce((a, e) => a + e.xp, 0)
  const [grade] = buildGradebook([student], assignments ?? [], subs ?? [], policyFromSettings(settings), new Map([[student.id, totalXp]]))
  return {
    student,
    room: room as ClassroomRow | null,
    xp: totalXp,
    score: grade?.score ?? null,
    recentXp: (xp as XpEventRow[]).slice(0, 15),
    sessions: (sessions ?? []).map(
      (s): SessionProgress => ({ session_no: s.session_no, title: s.title, done: Math.min(done.get(s.session_no) ?? 0, stepCount(s)), total: stepCount(s), open: open.has(s.session_no) }),
    ),
    games: bestByGame(plays ?? [], games ?? []),
    badges: (myBadges as StudentBadgeRow[]).flatMap((b) => {
      const info = badgeInfo.get(b.badge_id)
      return info ? [{ ...info, earned_at: b.earned_at }] : []
    }),
    attendance: attendance as AttendanceRow[],
  }
}
export type StudentProgress = Awaited<ReturnType<typeof fetchStudentProgress>>

// ล้างขั้นที่ทำเสร็จของคาบหนึ่ง (XP งาน คะแนน และการเช็คชื่อยังอยู่)
export async function resetSessionProgress(studentId: string, sessionNo: number) {
  const { error } = await supabase.from('session_progress').delete().eq('student_id', studentId).eq('session_no', sessionNo)
  if (error) throw error
}
