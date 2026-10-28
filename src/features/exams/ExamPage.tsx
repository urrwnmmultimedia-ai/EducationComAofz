import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { ExamAttemptRow, ExamRow } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { examErrorText, formatClock, isAnswered, type ActiveAttempt, type ExamResult } from './examModel'
import { EXAM_KIND_LABELS, ExamError, fetchExam, fetchExamResult, fetchMyAttempts, startExam } from './examsApi'
import { ExamResultView } from './ExamResultView'
import { QuestionInput, QuestionPrompt } from './QuestionInput'
import { useExamSession } from './useExamSession'

type View = { kind: 'intro' } | { kind: 'taking'; attempt: ActiveAttempt } | { kind: 'result'; result: ExamResult }

export function ExamPage() {
  const id = useParams().id ?? ''
  const { identity } = useAuth()
  const studentId = identity.student?.id ?? ''
  const state = useAsync(async () => {
    const [exam, attempts] = await Promise.all([fetchExam(id), fetchMyAttempts(studentId, id)])
    return { exam, attempts }
  }, [id, studentId])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data.exam) return <ErrorBlock message="ไม่พบชุดข้อสอบนี้" />
  return <ExamFlow exam={state.data.exam} attempts={state.data.attempts} />
}

function ExamFlow({ exam, attempts }: { exam: ExamRow; attempts: ExamAttemptRow[] }) {
  const [view, setView] = useState<View>({ kind: 'intro' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backTo = exam.session_no ? `/sessions/${exam.session_no}` : '/home'

  const open = attempts.find((a) => !a.submitted_at)
  const done = attempts.filter((a) => a.submitted_at)
  const left = exam.max_attempts - attempts.length + (open ? 1 : 0)
  const last = done[done.length - 1]

  const begin = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (exam.require_fullscreen && document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => undefined)
      }
      const res = await startExam(exam.id)
      if ('finished' in res) {
        if (res.result) setView({ kind: 'result', result: res.result })
        else setError('ทำครบจำนวนครั้งแล้ว')
      } else {
        setView({ kind: 'taking', attempt: res })
      }
    } catch (e) {
      setError(examErrorText(e instanceof ExamError ? e.message : undefined))
    } finally {
      setBusy(false)
    }
  }

  const showLast = async () => {
    if (!last || busy) return
    setBusy(true)
    try {
      setView({ kind: 'result', result: await fetchExamResult(last.id) })
    } catch {
      setError('โหลดผลไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const onFinished = useCallback((result: ExamResult) => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    setView({ kind: 'result', result })
  }, [])

  if (view.kind === 'taking') return <TakingExam attempt={view.attempt} onFinished={onFinished} />
  if (view.kind === 'result') return <ExamResultView result={view.result} backTo={backTo} />

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to={backTo} className="hover:text-brand-700">
          ← กลับ
        </Link>
      </nav>
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-brand-100">
        <p className="font-display text-brand-600">{EXAM_KIND_LABELS[exam.kind]}</p>
        <h1 className="text-2xl text-brand-900">{exam.title}</h1>
        <ul className="mt-4 grid gap-2 text-slate-700 sm:grid-cols-2">
          <li>📝 {exam.question_ids.length} ข้อ</li>
          <li>⏱️ {exam.duration_min ? `${exam.duration_min} นาที` : 'ไม่จำกัดเวลา'}</li>
          <li>🔁 ทำได้ {exam.max_attempts} ครั้ง (เหลือ {Math.max(0, left)})</li>
          {exam.closes_at && <li>📅 ปิด {new Date(exam.closes_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</li>}
        </ul>
        <div className="mt-4 rounded-2xl bg-sun-300/40 p-4 text-sm text-amber-950">
          <p className="font-display">ก่อนเริ่ม</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>คำตอบบันทึกอัตโนมัติทุกข้อ ถ้าเน็ตหลุดให้เข้ามาทำต่อได้</li>
            <li>เมื่อหมดเวลา ระบบส่งคำตอบให้อัตโนมัติ</li>
            <li>การสลับแท็บหรือออกจากหน้าสอบจะถูกบันทึกให้ครูเห็น{exam.require_fullscreen && ' และชุดนี้จะเปิดแบบเต็มจอ'}</li>
          </ul>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {(open || left > 0) && (
            <Button loading={busy} loadingText="กำลังเตรียมข้อสอบ…" onClick={() => void begin()}>
              {open ? 'ทำข้อสอบต่อ' : 'เริ่มทำข้อสอบ'}
            </Button>
          )}
          {last && (
            <Button variant="secondary" disabled={busy} onClick={() => void showLast()}>
              ดูผลครั้งล่าสุด ({Number(last.score ?? 0)}/{Number(last.max_points ?? 0)})
            </Button>
          )}
          {error && <span className="text-rose-600">{error}</span>}
        </div>
      </section>
    </div>
  )
}

function TakingExam({ attempt, onFinished }: { attempt: ActiveAttempt; onFinished: (r: ExamResult) => void }) {
  const s = useExamSession(attempt, onFinished)
  const [index, setIndex] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const qs = attempt.questions
  const q = qs[index]
  const answeredCount = qs.filter((x) => isAnswered(x, s.answers[x.id])).length
  const lowTime = s.left != null && s.left < 60_000

  if (!q) return <ErrorBlock message="ชุดนี้ยังไม่มีข้อสอบ" />

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-sm ring-1 ring-brand-100 backdrop-blur">
        <p className="min-w-0 flex-1 truncate font-display text-brand-900">{attempt.exam.title}</p>
        <span className="text-sm text-slate-500">
          ตอบแล้ว {answeredCount}/{qs.length}
        </span>
        <span className="text-xs text-slate-500" role="status">
          {s.saveState === 'saving' ? 'กำลังบันทึก…' : s.saveState === 'saved' ? 'บันทึกแล้ว ✓' : s.saveState === 'offline' ? '⚠️ ยังไม่ได้บันทึก (เน็ตหลุด)' : ''}
        </span>
        {s.left != null && (
          <span className={`rounded-full px-3 py-1 font-display tabular-nums ${lowTime ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
            ⏱ {formatClock(s.left)}
          </span>
        )}
      </header>

      {s.tabSwitches > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">ระบบบันทึกว่าออกจากหน้าสอบ {s.tabSwitches} ครั้ง กรุณาอยู่ในหน้านี้จนส่งข้อสอบ</p>
      )}

      <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
        <QuestionPrompt no={index + 1} prompt={q.prompt} />
        <QuestionInput
          key={q.id}
          question={q}
          answer={s.answers[q.id]}
          onChange={(a) => s.setAnswer(q.id, a)}
          shuffleSeed={attempt.exam.shuffle_choices ? attempt.attempt_id : null}
        />
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ← ข้อก่อนหน้า
          </Button>
          {index < qs.length - 1 ? (
            <Button onClick={() => setIndex(index + 1)}>ข้อถัดไป →</Button>
          ) : (
            <Button onClick={() => setConfirming(true)}>ส่งข้อสอบ</Button>
          )}
        </div>
      </section>

      <nav aria-label="เลือกข้อ" className="flex flex-wrap gap-1.5">
        {qs.map((x, i) => {
          const done = isAnswered(x, s.answers[x.id])
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
              aria-label={`ข้อ ${i + 1}${done ? ' ตอบแล้ว' : ''}`}
              className={`size-10 rounded-xl font-display text-sm ${
                i === index ? 'bg-brand-600 text-white' : done ? 'bg-mint-400/30 text-emerald-900' : 'bg-white text-slate-500 ring-1 ring-brand-100'
              }`}
            >
              {i + 1}
            </button>
          )
        })}
      </nav>

      {(confirming || s.submitError) && (
        <section className="rounded-3xl bg-brand-50 p-5 ring-1 ring-brand-200" role="alertdialog" aria-label="ยืนยันส่งข้อสอบ">
          <p className="font-display text-brand-900">
            ส่งข้อสอบเลยไหม? {answeredCount < qs.length && <span className="text-rose-600">ยังไม่ได้ตอบ {qs.length - answeredCount} ข้อ</span>}
          </p>
          <p className="text-sm text-slate-600">ส่งแล้วแก้ไขไม่ได้</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button loading={s.submitting} loadingText="กำลังส่ง…" onClick={() => void s.submit()}>
              ยืนยันส่ง
            </Button>
            <Button variant="ghost" disabled={s.submitting} onClick={() => setConfirming(false)}>
              กลับไปตรวจคำตอบ
            </Button>
          </div>
          {s.submitError && <p className="mt-2 text-sm text-rose-600">{s.submitError}</p>}
        </section>
      )}
    </div>
  )
}
