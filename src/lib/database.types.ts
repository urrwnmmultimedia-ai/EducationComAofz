// ชนิดข้อมูลของฐานข้อมูล (เขียนเองเฉพาะส่วนที่ใช้งานแล้ว)
// เมื่อเชื่อมโปรเจกต์ Supabase แล้วสามารถสร้างใหม่ทั้งไฟล์ด้วย:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AppSettingsRow = {
  id: number
  school_name: string
  term: number
  year: number
  student_code_length: number
  score_weights: Json
  grade_scale: Json
  late_penalty_enabled: boolean
  late_penalty_pct: number
  device_lock: boolean
  leaderboard_mode: 'all' | 'top10' | 'hidden'
  affective_full_xp: number
  updated_at: string
}

export type ClassroomRow = {
  id: string
  name: string
  sort_order: number
  created_at: string
}

export type StudentRow = {
  id: string
  student_code: string
  prefix: string
  first_name: string
  last_name: string
  nickname: string
  classroom_id: string | null
  number: number | null
  avatar: string
  is_active: boolean
  bound_auth_uid: string | null
  bound_device_key: string | null
  created_at: string
}

export type SessionRow = {
  auth_uid: string
  role: 'admin' | 'student'
  student_id: string | null
  device_info: Json
  created_at: string
  last_seen_at: string
}

export type UnitRow = {
  id: string
  no: number
  title: string
  description: string
  indicators: number[]
  cover: string | null
  objectives: string[]
  mindmap: Json
}

export type ClassSessionRow = {
  id: string
  session_no: number
  unit_id: string | null
  title: string
  summary: string
  work_label: string
  game_slug: string | null
  steps: Json
}

export type LessonRow = {
  id: string
  unit_id: string | null
  session_no: number | null
  title: string
  content_md: string
  sort_order: number
  est_minutes: number
}

export type ClassroomSessionUnlockRow = {
  classroom_id: string
  session_no: number
  is_unlocked: boolean
  unlocked_at: string | null
}

export type AssignmentRow = {
  id: string
  session_no: number | null
  unit_id: string | null
  title: string
  instructions_md: string
  type: 'text' | 'table' | 'file' | 'link' | 'score_only'
  max_score: number
  rubric: Json
  config: Json
  due_at: string | null
  category: 'work' | 'project' | 'unit_test' | 'midterm' | 'final'
  sort_order: number
  created_at: string
}

export type SubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  content: Json
  file_paths: string[]
  submitted_at: string | null
  score: number | null
  feedback: string | null
  status: 'draft' | 'submitted' | 'returned' | 'graded'
  updated_at: string
}

export type XpEventRow = {
  id: string
  student_id: string
  source: 'game' | 'assignment' | 'exit_ticket' | 'attendance' | 'badge' | 'manual'
  ref_id: string | null
  xp: number
  created_at: string
}

export type AttendanceRow = {
  student_id: string
  session_no: number
  classroom_id: string | null
  status: 'present' | 'late' | 'absent' | 'leave'
  checked_at: string
}

export type StudentBadgeRow = {
  student_id: string
  badge_id: string
  earned_at: string
}

export type QuestionRow = {
  id: string
  unit_id: string | null
  topic: string
  indicator: number | null
  type: 'mcq' | 'true_false' | 'matching' | 'ordering' | 'fill' | 'short'
  prompt: string
  choices: Json
  correct_answer: Json
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  reviewed: boolean
  created_at: string
}

export type ExamRow = {
  id: string
  title: string
  kind: 'exit_ticket' | 'unit_test' | 'midterm' | 'final' | 'pretest' | 'posttest' | 'practice'
  unit_id: string | null
  session_no: number | null
  assignment_id: string | null
  question_ids: string[]
  duration_min: number | null
  opens_at: string | null
  closes_at: string | null
  shuffle: boolean
  shuffle_choices: boolean
  max_attempts: number
  show_answers: boolean
  require_fullscreen: boolean
  created_at: string
}

export type ExamAttemptRow = {
  id: string
  exam_id: string
  student_id: string
  attempt_no: number
  started_at: string
  submitted_at: string | null
  answers: Json
  score: number | null
  tab_switches: number
  question_order: string[]
  points: Json
  max_points: number | null
  needs_review: boolean
  deadline_at: string | null
  saved_at: string | null
}

export type GameRow = {
  id: string
  slug: string
  unit_id: string | null
  title: string
  description: string
  config: Json
  max_score: number
  max_xp: number
  min_duration_sec: number
  is_active: boolean
}

export type GamePlayRow = {
  id: string
  game_id: string
  student_id: string
  score: number
  duration_sec: number
  xp_earned: number
  played_at: string
}

export type BadgeRow = {
  id: string
  code: string
  name: string
  icon: string
  rule: Json
}

export type MyGameItem = {
  slug: string
  title: string
  description: string
  unit_no: number | null
  max_xp: number
  is_unlocked: boolean
  session_nos: number[]
  plays: number
  best_score: number | null
  plays_today: number
}

export type LeaderboardRow = {
  rank: number
  nickname: string
  avatar: string
  classroom_name: string | null
  xp: number
  is_me: boolean
}

export type SessionListItem = {
  session_no: number
  unit_id: string | null
  title: string
  is_unlocked: boolean
  unlocked_at: string | null
  completed_steps: string[]
  total_steps: number
}

type Table<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      app_settings: Table<AppSettingsRow>
      classrooms: Table<ClassroomRow>
      students: Table<StudentRow>
      sessions: Table<SessionRow>
      units: Table<UnitRow>
      class_sessions: Table<ClassSessionRow>
      lessons: Table<LessonRow>
      classroom_session_unlocks: Table<ClassroomSessionUnlockRow>
      assignments: Table<AssignmentRow>
      submissions: Table<SubmissionRow>
      xp_events: Table<XpEventRow>
      student_badges: Table<StudentBadgeRow>
      attendance: Table<AttendanceRow>
      questions: Table<QuestionRow>
      exams: Table<ExamRow>
      exam_attempts: Table<ExamAttemptRow>
      games: Table<GameRow>
      game_plays: Table<GamePlayRow>
      badges: Table<BadgeRow>
      leaderboard_ticks: Table<{ id: number; updated_at: string }>
    }
    Views: Record<never, never>
    Functions: {
      login_with_code: { Args: { p_code: string; p_device_key?: string }; Returns: Json }
      whoami: { Args: Record<string, never>; Returns: Json }
      logout: { Args: Record<string, never>; Returns: undefined }
      admin_set_admin_code: { Args: { p_new_code: string }; Returns: undefined }
      admin_reset_device: { Args: { p_student_id: string }; Returns: undefined }
      grade_submission: {
        Args: { p_submission_id: string; p_score: number | null; p_feedback: string; p_status?: 'graded' | 'returned' }
        Returns: undefined
      }
      admin_set_score: { Args: { p_assignment_id: string; p_student_id: string; p_score: number | null }; Returns: undefined }
      my_gradebook_items: {
        Args: Record<string, never>
        Returns: Pick<AssignmentRow, 'id' | 'session_no' | 'title' | 'category' | 'type' | 'max_score' | 'due_at' | 'sort_order'>[]
      }
      admin_import_students: { Args: { p_rows: Json }; Returns: Json }
      start_exam: { Args: { p_exam_id: string }; Returns: Json }
      save_exam_answer: { Args: { p_attempt_id: string; p_question_id: string; p_answer: Json }; Returns: string }
      record_tab_switch: { Args: { p_attempt_id: string }; Returns: number }
      submit_exam: { Args: { p_attempt_id: string }; Returns: Json }
      exam_result: { Args: { p_attempt_id: string }; Returns: Json }
      admin_grade_exam_answer: { Args: { p_attempt_id: string; p_question_id: string; p_points: number }; Returns: Json }
      admin_rescore_exam: { Args: { p_exam_id: string }; Returns: number }
      submit_game_result: { Args: { p_slug: string; p_score: number; p_duration_sec: number }; Returns: Json }
      my_games: { Args: Record<string, never>; Returns: MyGameItem[] }
      leaderboard: { Args: { p_scope?: string; p_classroom_id?: string | null }; Returns: LeaderboardRow[] }
      set_my_avatar: { Args: { p_avatar: string }; Returns: undefined }
      my_session_list: { Args: Record<string, never>; Returns: SessionListItem[] }
      checkin_session: { Args: { p_session_no: number }; Returns: boolean }
      mark_step_done: { Args: { p_session_no: number; p_step: string }; Returns: string[] }
      admin_swap_sessions: { Args: { p_a: number; p_b: number }; Returns: undefined }
      admin_set_session_unlock: {
        Args: { p_session_no: number; p_unlocked: boolean; p_classroom_id?: string | null }
        Returns: undefined
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
