import { supabase } from '@/lib/supabase'
import type { AssignmentRow, Json, SubmissionRow } from '@/lib/database.types'
import { storagePath } from './assignmentModel'

export interface AssignmentWithSubmission {
  assignment: AssignmentRow
  submission: SubmissionRow | null
}

export async function fetchAssignmentForStudent(id: string, studentId: string): Promise<AssignmentWithSubmission | null> {
  const [a, s] = await Promise.all([
    supabase.from('assignments').select('*').eq('id', id).maybeSingle(),
    supabase.from('submissions').select('*').eq('assignment_id', id).eq('student_id', studentId).maybeSingle(),
  ])
  if (a.error) throw a.error
  if (s.error) throw s.error
  if (!a.data) return null
  return { assignment: a.data, submission: s.data }
}

export async function saveSubmission(input: {
  assignmentId: string
  studentId: string
  content: Json
  filePaths: string[]
  status: 'draft' | 'submitted'
}): Promise<SubmissionRow> {
  const { data, error } = await supabase
    .from('submissions')
    .upsert(
      {
        assignment_id: input.assignmentId,
        student_id: input.studentId,
        content: input.content,
        file_paths: input.filePaths,
        status: input.status,
      },
      { onConflict: 'assignment_id,student_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function uploadSubmissionFile(studentId: string, assignmentId: string, file: File): Promise<string> {
  const path = storagePath(studentId, assignmentId, file.name)
  const { error } = await supabase.storage.from('submissions').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

export async function removeSubmissionFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from('submissions').remove([path])
  if (error) throw error
}

// ลิงก์ดูไฟล์ชั่วคราว (bucket เป็น private)
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()
  const { data, error } = await supabase.storage.from('submissions').createSignedUrls(paths, 60 * 30)
  if (error) throw error
  const map = new Map<string, string>()
  for (const d of data) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl)
  return map
}

export async function fetchMyGradebook(studentId: string) {
  const [assignments, submissions, xp] = await Promise.all([
    supabase.rpc('my_gradebook_items'),
    supabase.from('submissions').select('*').eq('student_id', studentId),
    supabase.from('xp_events').select('xp').eq('student_id', studentId),
  ])
  if (assignments.error) throw assignments.error
  if (submissions.error) throw submissions.error
  if (xp.error) throw xp.error
  return {
    assignments: assignments.data,
    submissions: submissions.data,
    totalXp: xp.data.reduce((s, e) => s + e.xp, 0),
  }
}
