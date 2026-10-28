import { supabase } from '@/lib/supabase'
import type {
  CourseKey,
  ClassSessionRow,
  ClassroomRow,
  ClassroomSessionUnlockRow,
  LessonRow,
  UnitRow,
} from '@/lib/database.types'
import type { SessionStep } from '@/features/lessons/sessionSteps'

export interface AdminSessionsData {
  sessions: ClassSessionRow[]
  classrooms: ClassroomRow[]
  unlocks: ClassroomSessionUnlockRow[]
  units: UnitRow[]
}

export async function fetchAdminSessions(): Promise<AdminSessionsData> {
  const [sessions, classrooms, unlocks, units] = await Promise.all([
    supabase.from('class_sessions').select('*').order('session_no'),
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
    supabase.from('classroom_session_unlocks').select('*'),
    supabase.from('units').select('*').order('no'),
  ])
  if (sessions.error) throw sessions.error
  if (classrooms.error) throw classrooms.error
  if (unlocks.error) throw unlocks.error
  if (units.error) throw units.error
  return { sessions: sessions.data, classrooms: classrooms.data, unlocks: unlocks.data, units: units.data }
}

export async function setSessionUnlock(sessionNo: number, unlocked: boolean, classroomId: string | null) {
  const { error } = await supabase.rpc('admin_set_session_unlock', {
    p_session_no: sessionNo,
    p_unlocked: unlocked,
    p_classroom_id: classroomId,
  })
  if (error) throw error
}

export async function swapSessions(a: number, b: number) {
  const { error } = await supabase.rpc('admin_swap_sessions', { p_a: a, p_b: b })
  if (error) throw error
}

export interface SessionEditData {
  session: ClassSessionRow
  lessons: LessonRow[]
  units: UnitRow[]
}

export async function fetchSessionForEdit(no: number): Promise<SessionEditData | null> {
  const [session, lessons, units] = await Promise.all([
    supabase.from('class_sessions').select('*').eq('session_no', no).maybeSingle(),
    supabase.from('lessons').select('*').eq('session_no', no).order('sort_order'),
    supabase.from('units').select('*').order('no'),
  ])
  if (session.error) throw session.error
  if (lessons.error) throw lessons.error
  if (units.error) throw units.error
  if (!session.data) return null
  return { session: session.data, lessons: lessons.data, units: units.data }
}

export interface SessionPatch {
  title: string
  summary: string
  work_label: string
  game_slug: string | null
  unit_id: string | null
  steps: SessionStep[]
}

export async function saveSession(id: string, patch: SessionPatch) {
  const { error } = await supabase.from('class_sessions').update(patch).eq('id', id)
  if (error) throw error
}

export async function saveLesson(lesson: Pick<LessonRow, 'id' | 'title' | 'content_md'>) {
  const { error } = await supabase
    .from('lessons')
    .update({ title: lesson.title, content_md: lesson.content_md })
    .eq('id', lesson.id)
  if (error) throw error
}

export async function createLesson(sessionNo: number, unitId: string | null, sortOrder: number): Promise<LessonRow> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({ session_no: sessionNo, unit_id: unitId, title: 'บทเรียนใหม่', content_md: '## หัวข้อแรก\nเนื้อหา…', sort_order: sortOrder })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteLesson(id: string) {
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}

export async function fetchClassrooms(): Promise<ClassroomRow[]> {
  const { data, error } = await supabase.from('classrooms').select('*').order('sort_order').order('name')
  if (error) throw error
  return data
}

export async function upsertClassroom(room: { id?: string; name: string; sort_order: number; course: CourseKey }) {
  const row = { name: room.name, sort_order: room.sort_order, course: room.course }
  const { error } = room.id
    ? await supabase.from('classrooms').update(row).eq('id', room.id)
    : await supabase.from('classrooms').insert(row)
  if (error) throw error
}
