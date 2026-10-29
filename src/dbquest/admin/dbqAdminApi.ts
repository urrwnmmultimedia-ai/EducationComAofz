import { z } from 'zod'
import { supabase } from '@/lib/supabase'

// RPC หลังบ้านครู DB Quest — คำนวณคะแนนที่เซิร์ฟเวอร์ (dbq_student_scores) หน้าเว็บแค่แสดงผล

export const CATEGORIES = ['worksheet', 'unit_quiz', 'game', 'project', 'attendance', 'midterm', 'final'] as const
export type Category = (typeof CATEGORIES)[number]
export const MANUAL_CATEGORIES = ['unit_quiz', 'project', 'attendance', 'midterm', 'final'] as const
export type ManualCategory = (typeof MANUAL_CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  worksheet: 'ใบงาน',
  unit_quiz: 'ทดสอบท้ายหน่วย',
  game: 'เกม',
  project: 'โครงงาน',
  attendance: 'จิตพิสัย',
  midterm: 'สอบกลางภาค',
  final: 'สอบปลายภาค',
}

const num = z.coerce.number()
const numOrNull = z.coerce.number().nullable()

const categoryScore = z.object({ weight: num, earned: numOrNull, max: numOrNull, pct: numOrNull, points: numOrNull })
export const scoresSchema = z.object({
  categories: z.record(z.enum(CATEGORIES), categoryScore),
  total: num,
  available: num,
  current_pct: numOrNull,
})
export type Scores = z.infer<typeof scoresSchema>

export const briefSchema = z.object({
  id: z.string(),
  student_code: z.string(),
  number: z.number().nullable(),
  name: z.string(),
  nickname: z.string(),
  classroom_id: z.string().nullable(),
  classroom_name: z.string().nullable(),
  is_active: z.boolean(),
})
export type StudentBrief = z.infer<typeof briefSchema>

const overviewSchema = z.object({
  pending_grading: num,
  classrooms: z.array(
    z.object({ id: z.string(), name: z.string(), students: num, active_7d: num, avg_xp: num, pending_grading: num }),
  ),
  sessions: z.array(z.object({ session_no: z.number(), title: z.string(), kind: z.string(), started: num, completed: num })),
})
export type Overview = z.infer<typeof overviewSchema>

const studentRowSchema = briefSchema.extend({
  xp: num,
  sessions_done: num,
  current_session: z.number().nullable(),
  badges: num,
  last_active: z.string().nullable(),
})
export type StudentRow = z.infer<typeof studentRowSchema>

const detailSchema = z.object({
  student: briefSchema,
  xp: num,
  scores: scoresSchema,
  sessions: z.array(
    z.object({ session_no: z.number(), title: z.string(), kind: z.string(), open: z.boolean(), pct: numOrNull, steps_done: z.array(z.string()) }),
  ),
  games: z.array(z.object({ game_key: z.string(), best_score: num, best_stars: num, plays: num, last_played: z.string() })),
  badges: z.array(z.object({ key: z.string(), name: z.string(), icon: z.string(), earned_at: z.string() })),
  recent_xp: z.array(z.object({ source: z.string(), amount: num, created_at: z.string() })),
})
export type StudentDetail = z.infer<typeof detailSchema>

const rubricSchema = z.array(z.object({ criterion: z.string(), points: num })).nullable()
const submissionSchema = z.object({
  id: z.string(),
  assignment: z.object({ id: z.string(), item_id: z.string(), title: z.string(), max_score: num, session_no: z.number().nullable() }),
  student: briefSchema,
  content: z.object({ text: z.string().optional() }).passthrough(),
  score: numOrNull,
  feedback: z.string().nullable(),
  submitted_at: z.string(),
  graded_at: z.string().nullable(),
  rubric: rubricSchema,
  sample: z.string().nullable(),
})
export type Submission = z.infer<typeof submissionSchema>

const workCell = z.object({ status: z.enum(['missing', 'submitted', 'graded']), score: numOrNull, submission_id: z.string().nullable() })
export type WorkCell = z.infer<typeof workCell>
const gradebookSchema = z.object({
  weights: z.record(z.string(), num),
  assignments: z.array(z.object({ id: z.string(), item_id: z.string(), title: z.string(), max_score: num, session_no: z.number().nullable() })),
  manual_max: z.record(z.string(), num),
  rows: z.array(
    briefSchema.extend({
      work: z.record(z.string(), workCell),
      manual: z.record(z.string(), z.object({ score: num, max: num })),
      xp: num,
      scores: scoresSchema,
    }),
  ),
})
export type Gradebook = z.infer<typeof gradebookSchema>
export type GradebookRow = Gradebook['rows'][number]

const unlockSchema = z.array(z.object({ classroom_id: z.string(), name: z.string(), students: num, unlocked: z.array(z.number()) }))
export type UnlockRoom = z.infer<typeof unlockSchema>[number]

const settingsSchema = z.object({
  score_weights: z.record(z.string(), num),
  leaderboard_enabled: z.boolean(),
  unlock_threshold_pct: num,
})
export type DbqSettings = z.infer<typeof settingsSchema>

const keyItemSchema = z.object({
  item_id: z.string(),
  item_type: z.string(),
  grade_type: z.string(),
  unit_no: z.number().nullable(),
  session_no: z.number().nullable(),
  answer: z.record(z.string(), z.unknown()),
  explanation: z.string(),
  hint: z.string(),
  rubric: rubricSchema,
  teacher_notes: z.string(),
})
export type AnswerKeyItem = z.infer<typeof keyItemSchema>

const ERRORS: Record<string, string> = {
  forbidden: 'ต้องเข้าสู่ระบบด้วยรหัสครู',
  invalid_score: 'คะแนนต้องอยู่ระหว่าง 0 ถึงคะแนนเต็ม',
  weights_must_sum_100: 'น้ำหนักคะแนนรวมกันต้องได้ 100',
  invalid_value: 'ค่าที่กรอกไม่ถูกต้อง',
  not_found: 'ไม่พบข้อมูล',
}

async function rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await supabase.rpc(fn as 'dbq_me', args as never)
  if (error) throw new Error(ERRORS[error.message] ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
  return data
}

export const fetchOverview = async () => overviewSchema.parse(await rpc('dbq_admin_overview'))

export const fetchStudents = async (classroomId: string | null) =>
  z.array(studentRowSchema).parse(await rpc('dbq_admin_students', { p_classroom_id: classroomId }))

export const fetchStudentDetail = async (id: string) => detailSchema.parse(await rpc('dbq_admin_student_detail', { p_student_id: id }))

export const fetchSubmissions = async (filter: { status: 'pending' | 'graded' | 'all'; session_no?: number; classroom_id?: string }) =>
  z.array(submissionSchema).parse(await rpc('dbq_admin_submissions', { p_filter: filter }))

export async function gradeSubmission(id: string, score: number | null, feedback: string): Promise<void> {
  await rpc('dbq_admin_grade_submission', { p_submission_id: id, p_score: score, p_feedback: feedback })
}

export const fetchGradebook = async (classroomId: string | null) =>
  gradebookSchema.parse(await rpc('dbq_admin_gradebook', { p_classroom_id: classroomId }))

export async function setManualScore(studentId: string, category: ManualCategory, score: number | null, max: number): Promise<void> {
  await rpc('dbq_admin_set_manual_score', { p_student_id: studentId, p_category: category, p_score: score, p_max_score: max })
}

export const fetchUnlocks = async () => unlockSchema.parse(await rpc('dbq_admin_unlock_overview'))

export async function setUnlock(sessionNo: number, unlocked: boolean, classroomId: string | null): Promise<void> {
  await rpc('dbq_admin_set_unlock', { p_session: sessionNo, p_unlocked: unlocked, p_classroom_id: classroomId })
}

export const fetchSettings = async () => settingsSchema.parse(await rpc('dbq_admin_get_settings'))

export async function saveSetting(key: keyof DbqSettings, value: unknown): Promise<void> {
  await rpc('dbq_admin_set_setting', { p_key: key, p_value: value })
}

// รีเซ็ตคาบของนักเรียน 1 คน: ลบความคืบหน้า คำตอบ ใบงาน คะแนนเกม และ XP ของคาบนั้น (เหรียญยังอยู่)
export async function resetSession(studentId: string, sessionNo: number): Promise<void> {
  await rpc('dbq_admin_reset_session', { p_student_id: studentId, p_session: sessionNo })
}

export async function fetchAnswerKeys(sessionNo: number): Promise<AnswerKeyItem[]> {
  const data = z.object({ items: z.array(keyItemSchema) }).parse(await rpc('dbq_get_answer_key', { p_scope: { session_no: sessionNo } }))
  return data.items
}
