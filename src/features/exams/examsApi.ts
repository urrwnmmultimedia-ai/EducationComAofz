import { supabase } from '@/lib/supabase'
import type { ExamAttemptRow, ExamRow, Json } from '@/lib/database.types'
import { z } from 'zod'
import { examResultSchema, feedbackSchema, startResponseSchema, type Answer, type ExamResult, type Feedback, type StartResponse } from './examModel'

export class ExamError extends Error {}

const fail = (err: { message: string }): never => {
  throw new ExamError(err.message)
}

export async function startExam(examId: string): Promise<StartResponse> {
  const { data, error } = await supabase.rpc('start_exam', { p_exam_id: examId })
  if (error) fail(error)
  return startResponseSchema.parse(data)
}

export async function saveAnswer(attemptId: string, questionId: string, answer: Answer): Promise<void> {
  const { error } = await supabase.rpc('save_exam_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_answer: answer as unknown as Json,
  })
  if (error) fail(error)
}

// ตอบแล้วตรวจทันที: เซิร์ฟเวอร์บันทึกคำตอบ ล็อกข้อ แล้วบอกถูก/ผิดพร้อมเฉลย
export async function checkExamAnswer(attemptId: string, questionId: string, answer: Answer): Promise<Feedback> {
  const { data, error } = await supabase.rpc('check_exam_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_answer: answer as unknown as Json,
  })
  if (error) fail(error)
  return feedbackSchema.parse(data)
}

export async function fetchCheckedFeedback(attemptId: string): Promise<Record<string, Feedback>> {
  const { data, error } = await supabase.rpc('exam_checked_feedback', { p_attempt_id: attemptId })
  if (error) fail(error)
  return z.record(z.string(), feedbackSchema).parse(data)
}

export async function recordTabSwitch(attemptId: string): Promise<void> {
  await supabase.rpc('record_tab_switch', { p_attempt_id: attemptId })
}

export async function submitExam(attemptId: string): Promise<ExamResult> {
  const { data, error } = await supabase.rpc('submit_exam', { p_attempt_id: attemptId })
  if (error) fail(error)
  return examResultSchema.parse(data)
}

export async function fetchExamResult(attemptId: string): Promise<ExamResult> {
  const { data, error } = await supabase.rpc('exam_result', { p_attempt_id: attemptId })
  if (error) fail(error)
  return examResultSchema.parse(data)
}

export async function fetchExam(examId: string): Promise<ExamRow | null> {
  const { data, error } = await supabase.from('exams').select('*').eq('id', examId).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchMyAttempts(studentId: string, examId?: string): Promise<ExamAttemptRow[]> {
  let q = supabase.from('exam_attempts').select('*').eq('student_id', studentId)
  if (examId) q = q.eq('exam_id', examId)
  const { data, error } = await q.order('started_at')
  if (error) throw error
  return data
}

export async function fetchExamsBySession(sessionNo: number): Promise<ExamRow[]> {
  const { data, error } = await supabase.from('exams').select('*').eq('session_no', sessionNo).order('created_at')
  if (error) throw error
  return data
}

export async function fetchAllExams(): Promise<ExamRow[]> {
  const { data, error } = await supabase.from('exams').select('*').order('session_no').order('created_at')
  if (error) throw error
  return data
}

export const EXAM_KIND_LABELS: Record<ExamRow['kind'], string> = {
  exit_ticket: 'Exit ticket',
  unit_test: 'ทดสอบท้ายหน่วย',
  midterm: 'สอบกลางภาค',
  final: 'สอบปลายภาค',
  pretest: 'ก่อนเรียน',
  posttest: 'หลังเรียน',
  practice: 'แบบฝึก',
}
