import { supabase } from '@/lib/supabase'
import type { AssignmentRow, ClassSessionRow, ClassroomRow, StudentRow, SubmissionRow } from '@/lib/database.types'
import { M3, roomsOf, studentsIn } from './courseScope'

export async function fetchAssignmentsAdmin(): Promise<{ assignments: AssignmentRow[]; sessions: ClassSessionRow[] }> {
  const [a, s] = await Promise.all([
    supabase.from('assignments').select('*').order('session_no').order('sort_order'),
    supabase.from('class_sessions').select('*').order('session_no'),
  ])
  if (a.error) throw a.error
  if (s.error) throw s.error
  return { assignments: a.data, sessions: s.data }
}

export type AssignmentInput = Pick<
  AssignmentRow,
  'title' | 'session_no' | 'unit_id' | 'instructions_md' | 'type' | 'max_score' | 'rubric' | 'config' | 'due_at' | 'category' | 'sort_order'
>

export async function saveAssignment(id: string | null, input: AssignmentInput): Promise<AssignmentRow> {
  const q = id
    ? supabase.from('assignments').update(input).eq('id', id).select('*').single()
    : supabase.from('assignments').insert(input).select('*').single()
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function deleteAssignment(id: string) {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw error
}

export interface GradingData {
  assignment: AssignmentRow
  classrooms: ClassroomRow[]
  students: StudentRow[]
  submissions: SubmissionRow[]
}

export async function fetchGradingData(assignmentId: string): Promise<GradingData | null> {
  const [a, c, st, sub] = await Promise.all([
    supabase.from('assignments').select('*').eq('id', assignmentId).maybeSingle(),
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
    supabase.from('students').select('*').eq('is_active', true).order('number'),
    supabase.from('submissions').select('*').eq('assignment_id', assignmentId),
  ])
  if (a.error) throw a.error
  if (c.error) throw c.error
  if (st.error) throw st.error
  if (sub.error) throw sub.error
  if (!a.data) return null
  const rooms = roomsOf(c.data, M3)
  return { assignment: a.data, classrooms: rooms, students: studentsIn(st.data, rooms, M3), submissions: sub.data }
}

export async function gradeSubmission(submissionId: string, score: number | null, feedback: string, status: 'graded' | 'returned') {
  const { error } = await supabase.rpc('grade_submission', {
    p_submission_id: submissionId,
    p_score: score,
    p_feedback: feedback,
    p_status: status,
  })
  if (error) throw error
}

export async function setScore(assignmentId: string, studentId: string, score: number | null) {
  const { error } = await supabase.rpc('admin_set_score', { p_assignment_id: assignmentId, p_student_id: studentId, p_score: score })
  if (error) throw error
}

export interface GradebookSource {
  classrooms: ClassroomRow[]
  students: StudentRow[]
  assignments: AssignmentRow[]
  submissions: SubmissionRow[]
  xp: { student_id: string; xp: number }[]
}

export async function fetchGradebookSource(): Promise<GradebookSource> {
  const [c, st, a, sub, xp] = await Promise.all([
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
    supabase.from('students').select('*').eq('is_active', true).order('number'),
    supabase.from('assignments').select('*'),
    supabase.from('submissions').select('*'),
    supabase.from('xp_events').select('student_id, xp'),
  ])
  for (const r of [c, st, a, sub, xp]) if (r.error) throw r.error
  const rooms = roomsOf(c.data ?? [], M3)
  return {
    classrooms: rooms,
    students: studentsIn(st.data ?? [], rooms, M3),
    assignments: a.data ?? [],
    submissions: sub.data ?? [],
    xp: xp.data ?? [],
  }
}
