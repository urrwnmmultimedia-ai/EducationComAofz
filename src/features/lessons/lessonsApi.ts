import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { AssignmentRow, ClassSessionRow, ExamRow, LessonRow, SessionListItem, UnitRow } from '@/lib/database.types'

export const mindmapSchema = z.array(z.object({ title: z.string(), children: z.array(z.string()).default([]) }))
export type MindmapBranch = z.infer<typeof mindmapSchema>[number]

export function parseMindmap(raw: unknown): MindmapBranch[] {
  const parsed = mindmapSchema.safeParse(raw)
  return parsed.success ? parsed.data : []
}

export async function fetchUnits(): Promise<UnitRow[]> {
  const { data, error } = await supabase.from('units').select('*').order('no')
  if (error) throw error
  return data
}

export async function fetchUnitByNo(no: number): Promise<UnitRow | null> {
  const { data, error } = await supabase.from('units').select('*').eq('no', no).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchSessionList(): Promise<SessionListItem[]> {
  const { data, error } = await supabase.rpc('my_session_list')
  if (error) throw error
  return data
}

export interface SessionDetail {
  session: ClassSessionRow
  lessons: LessonRow[]
  assignments: AssignmentRow[]
  exams: ExamRow[]
  unit: UnitRow | null
}

// null = คาบนี้ไม่มีหรือยังไม่ปลดล็อก (RLS ซ่อนไว้)
export async function fetchSessionDetail(no: number): Promise<SessionDetail | null> {
  const { data: session, error } = await supabase.from('class_sessions').select('*').eq('session_no', no).maybeSingle()
  if (error) throw error
  if (!session) return null

  const [lessons, assignments, exams, unit] = await Promise.all([
    supabase.from('lessons').select('*').eq('session_no', no).order('sort_order'),
    supabase.from('assignments').select('*').eq('session_no', no).order('sort_order'),
    supabase.from('exams').select('*').eq('session_no', no).order('created_at'),
    session.unit_id
      ? supabase.from('units').select('*').eq('id', session.unit_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (lessons.error) throw lessons.error
  if (assignments.error) throw assignments.error
  if (unit.error) throw unit.error
  if (exams.error) throw exams.error
  return { session, lessons: lessons.data, assignments: assignments.data, exams: exams.data, unit: unit.data }
}

export async function checkinSession(no: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('checkin_session', { p_session_no: no })
  if (error) throw error
  return data
}

export async function markStepDone(no: number, step: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('mark_step_done', { p_session_no: no, p_step: step })
  if (error) throw error
  return data
}

export async function fetchMyCompletedSteps(no: number): Promise<string[]> {
  const list = await fetchSessionList()
  return list.find((s) => s.session_no === no)?.completed_steps ?? []
}
