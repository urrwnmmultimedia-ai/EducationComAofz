import { useCallback, useEffect, useRef, useState } from 'react'
import { parseAnswer, remainingMs, type ActiveAttempt, type Answer, type ExamResult } from './examModel'
import { recordTabSwitch, saveAnswer, submitExam } from './examsApi'

export type SaveState = 'idle' | 'saving' | 'saved' | 'offline'

const SAVE_DELAY_MS = 600

// logic ระหว่างทำข้อสอบ: บันทึกคำตอบอัตโนมัติ, จับเวลา, นับการสลับแท็บ, ส่งข้อสอบ
export function useExamSession(attempt: ActiveAttempt, onFinished: (r: ExamResult) => void) {
  const clientAtStart = useRef(Date.now())
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
    const init: Record<string, Answer> = {}
    for (const [id, raw] of Object.entries(attempt.answers)) {
      const a = parseAnswer(raw)
      if (a) init[id] = a
    }
    return init
  })
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [tabSwitches, setTabSwitches] = useState(attempt.tab_switches)
  const [left, setLeft] = useState(() => remainingMs(attempt.deadline_at, attempt.server_now, clientAtStart.current, Date.now()))
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // คำตอบที่ยังไม่ได้บันทึก (ส่งซ้ำได้เมื่อเน็ตกลับมา)
  const pending = useRef(new Map<string, Answer>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finished = useRef(false)

  const flush = useCallback(async () => {
    if (pending.current.size === 0) return true
    const batch = [...pending.current.entries()]
    setSaveState('saving')
    try {
      for (const [qid, ans] of batch) {
        await saveAnswer(attempt.attempt_id, qid, ans)
        if (pending.current.get(qid) === ans) pending.current.delete(qid)
      }
      setSaveState(pending.current.size ? 'saving' : 'saved')
      return true
    } catch {
      // เน็ตหลุดหรือหมดเวลา: คำตอบยังค้างใน pending รอส่งรอบถัดไป
      setSaveState('offline')
      return false
    }
  }, [attempt.attempt_id])

  const setAnswer = useCallback(
    (qid: string, ans: Answer) => {
      if (finished.current) return
      setAnswers((a) => ({ ...a, [qid]: ans }))
      pending.current.set(qid, ans)
      setSaveState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush],
  )

  const submit = useCallback(async () => {
    if (finished.current || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    if (timer.current) clearTimeout(timer.current)
    await flush()
    try {
      const result = await submitExam(attempt.attempt_id)
      finished.current = true
      onFinished(result)
    } catch {
      setSubmitError('ส่งไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วกดส่งอีกครั้ง (คำตอบที่บันทึกแล้วไม่หาย)')
    } finally {
      setSubmitting(false)
    }
  }, [attempt.attempt_id, flush, onFinished, submitting])

  // นาฬิกา: หมดเวลาแล้วส่งอัตโนมัติ
  useEffect(() => {
    if (left == null) return
    const id = setInterval(() => {
      const ms = remainingMs(attempt.deadline_at, attempt.server_now, clientAtStart.current, Date.now())
      setLeft(ms)
      if (ms === 0) {
        clearInterval(id)
        void submit()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [attempt.deadline_at, attempt.server_now, left == null, submit])

  // นับการสลับแท็บ/ออกจากหน้า
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !finished.current) {
        setTabSwitches((n) => n + 1)
        void recordTabSwitch(attempt.attempt_id)
        void flush()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [attempt.attempt_id, flush])

  // เน็ตกลับมา: บันทึกที่ค้าง / เตือนก่อนปิดหน้า
  useEffect(() => {
    const onOnline = () => void flush()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!finished.current && pending.current.size > 0) e.preventDefault()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush])

  return { answers, setAnswer, saveState, tabSwitches, left, submit, submitting, submitError }
}
