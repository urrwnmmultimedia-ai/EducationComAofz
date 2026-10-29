import { useCallback, useEffect, useState } from 'react'
import { useAsync } from '@/lib/useAsync'
import { fetchMyCompletedSteps, fetchMySessionWork, fetchSessionDetail, markStepDone } from './lessonsApi'
import { parseSteps, type StepKey } from './sessionSteps'

// logic ทั้งหมดของหน้าคาบเรียน: โหลดข้อมูล และบันทึกขั้นตอนที่ทำเสร็จ (ไม่มีระบบเช็คชื่อ)
export function useSessionPage(sessionNo: number, isStudent: boolean, studentId: string | null) {
  const detail = useAsync(() => fetchSessionDetail(sessionNo), [sessionNo])
  const [completed, setCompleted] = useState<string[]>([])
  const [savingStep, setSavingStep] = useState<StepKey | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  // งาน/ชุดสอบของคาบที่ส่งแล้ว (null = ยังโหลดไม่เสร็จ)
  const [work, setWork] = useState<{ submitted: string[]; examsDone: string[] } | null>(null)

  const unlocked = detail.status === 'success' && detail.data !== null

  useEffect(() => {
    if (!unlocked || !isStudent) return
    let cancelled = false
    void fetchMyCompletedSteps(sessionNo).then(
      (steps) => !cancelled && setCompleted(steps),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [sessionNo, unlocked, isStudent])

  const assignmentIds = detail.data?.assignments.map((a) => a.id).join(',') ?? ''
  const examIds = detail.data?.exams.map((e) => e.id).join(',') ?? ''
  useEffect(() => {
    if (!unlocked || !isStudent || !studentId) return
    let cancelled = false
    void fetchMySessionWork(studentId, assignmentIds ? assignmentIds.split(',') : [], examIds ? examIds.split(',') : []).then(
      (w) => !cancelled && setWork(w),
      () => !cancelled && setWork({ submitted: [], examsDone: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [unlocked, isStudent, studentId, assignmentIds, examIds])

  const completeStep = useCallback(
    async (step: StepKey) => {
      if (!isStudent || savingStep) return
      setSavingStep(step)
      setSaveError(null)
      try {
        setCompleted(await markStepDone(sessionNo, step))
      } catch {
        setSaveError('บันทึกความคืบหน้าไม่สำเร็จ ลองกดอีกครั้ง')
      } finally {
        setSavingStep(null)
      }
    },
    [isStudent, savingStep, sessionNo],
  )

  const steps = detail.data ? parseSteps(detail.data.session.steps) : []

  // ส่งงาน/ข้อสอบที่ฝังในหน้าคาบแล้ว: อัปเดตสถานะทันทีไม่ต้องโหลดใหม่
  const markSent = useCallback((kind: 'assignment' | 'exam', id: string) => {
    setWork((w) => {
      const cur = w ?? { submitted: [], examsDone: [] }
      if (kind === 'assignment') return cur.submitted.includes(id) ? cur : { ...cur, submitted: [...cur.submitted, id] }
      return cur.examsDone.includes(id) ? cur : { ...cur, examsDone: [...cur.examsDone, id] }
    })
  }, [])

  return { detail, steps, completed, setCompleted, savingStep, saveError, completeStep, work, markSent }
}
