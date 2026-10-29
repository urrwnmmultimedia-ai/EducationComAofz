import { useCallback, useEffect, useState } from 'react'
import { useAsync } from '@/lib/useAsync'
import { checkinSession, fetchMyCompletedSteps, fetchSessionDetail, markStepDone } from './lessonsApi'
import { parseSteps, type StepKey } from './sessionSteps'

// logic ทั้งหมดของหน้าคาบเรียน: โหลดข้อมูล เช็คชื่อ และบันทึกขั้นตอนที่ทำเสร็จ
export function useSessionPage(sessionNo: number, isStudent: boolean) {
  const detail = useAsync(() => fetchSessionDetail(sessionNo), [sessionNo])
  const [completed, setCompleted] = useState<string[]>([])
  const [checkedIn, setCheckedIn] = useState(false)
  const [savingStep, setSavingStep] = useState<StepKey | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const unlocked = detail.status === 'success' && detail.data !== null

  useEffect(() => {
    if (!unlocked || !isStudent) return
    let cancelled = false
    void fetchMyCompletedSteps(sessionNo).then(
      (steps) => !cancelled && setCompleted(steps),
      () => undefined,
    )
    void checkinSession(sessionNo).then(
      (ok) => !cancelled && setCheckedIn(ok),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [sessionNo, unlocked, isStudent])

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

  return { detail, steps, completed, setCompleted, checkedIn, savingStep, saveError, completeStep }
}
