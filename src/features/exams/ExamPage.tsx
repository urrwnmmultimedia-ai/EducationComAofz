import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { useViewer } from '@/features/student/viewer'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { ExamAttemptRow, ExamRow } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { examErrorText, formatClock, isAnswered, parseAnswer, type ActiveAttempt, type Answer, type ExamResult, type Feedback } from './examModel'
import { EXAM_KIND_LABELS, ExamError, fetchExam, fetchExamResult, fetchMyAttempts, startExam } from './examsApi'
import { describeAnswer, ExamResultView } from './ExamResultView'
import { QuestionInput, QuestionPrompt } from './QuestionInput'
import { useExamSession } from './useExamSession'

type View = { kind: 'intro' } | { kind: 'taking'; attempt: ActiveAttempt } | { kind: 'result'; result: ExamResult }

export function ExamPage() {
  return <ExamView id={useParams().id ?? ''} />
}

// embedded: ฝังในหน้าคาบ — นักเรียนเปิดข้อสอบให้ทันทีไม่ต้องกดเริ่ม (ส่งแล้วแสดงผลครั้งล่าสุด)
// onSubmitted แจ้งเมื่อมีครั้งที่ส่งแล้ว
export function ExamView({ id, embedded = false, onSubmitted }: { id: string; embedded?: boolean; onSubmitted?: () => void }) {
  const { identity } = useAuth()
  const { student, isPreview } = useViewer()
  const studentId = student?.id ?? ''
  const state = useAsync(async () => {
    const [exam, attempts] = await Promise.all([fetchExam(id), fetchMyAttempts(studentId, id)])
    return { exam, attempts }
  }, [id, studentId])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data.exam) return <ErrorBlock message="ไม่พบชุดข้อสอบนี้" />
  return (
    <ExamFlow
      key={state.data.exam.id}
      exam={state.data.exam}
      attempts={state.data.attempts}
      autoStart={embedded && identity.role === 'student'}
      embedded={embedded}
      preview={isPreview}
      onSubmitted={onSubmitted}
    />
  )
}

function ExamFlow({
  exam,
  attempts,
  autoStart,
  embedded,
  preview,
  onSubmitted,
}: {
  exam: ExamRow
  attempts: ExamAttemptRow[]
  autoStart: boolean
  embedded: boolean
  preview: boolean // ครูดูตัวอย่าง: เห็นรายละเอียดชุดสอบ แต่เริ่มทำไม่ได้
  onSubmitted?: () => void
}) {
  const [view, setView] = useState<View>({ kind: 'intro' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backTo = embedded ? undefined : exam.session_no ? `/sessions/${exam.session_no}` : '/home'

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

  const notify = useRef(onSubmitted)
  notify.current = onSubmitted
  const onFinished = useCallback((result: ExamResult) => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    setView({ kind: 'result', result })
    notify.current?.()
  }, [])

  // ฝังในหน้าคาบ: ทำต่อ/เริ่มทันที หรือแสดงผลครั้งล่าสุดถ้าส่งไปแล้ว (ทำครั้งเดียวตอนเปิด)
  const autoRan = useRef(false)
  useEffect(() => {
    if (!autoStart || autoRan.current) return
    autoRan.current = true
    if (!open && last) void showLast()
    else if (open || left > 0) void begin()
  })

  if (view.kind === 'taking') return <TakingExam attempt={view.attempt} instant={exam.show_answers} onFinished={onFinished} />
  if (view.kind === 'result') return <ExamResultView result={view.result} backTo={backTo} />

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {backTo && (
        <nav className="text-sm text-slate-500">
          <Link to={backTo} className="hover:text-brand-700">
            ← กลับ
          </Link>
        </nav>
      )}
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
          {preview && <span className="text-sm text-amber-800">โหมดครู: ดูรายละเอียดได้ ทำข้อสอบได้เฉพาะนักเรียน</span>}
          {!preview && (open || left > 0) && (
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

// ปรนัย/ถูกผิด: แตะตัวเลือก = ตอบเลย · แบบอื่นกดปุ่มตรวจ/ยืนยัน
const TAP_TO_ANSWER = new Set(['mcq', 'true_false'])
const NEXT_DELAY = { right: 1400, wrong: 2800, saved: 700 }

// ทำข้อสอบทีละข้อ: ตอบแล้วตรวจทันที (ชุดที่เปิดให้ดูเฉลย) หรือบันทึก แล้วไปข้อถัดไปเอง · ข้อสุดท้ายแล้วถามยืนยันส่ง
function TakingExam({ attempt, instant, onFinished }: { attempt: ActiveAttempt; instant: boolean; onFinished: (r: ExamResult) => void }) {
  const s = useExamSession(attempt, onFinished, instant)
  const qs = attempt.questions
  const [index, setIndex] = useState(() => Math.max(0, qs.findIndex((x) => !isAnswered(x, parseAnswer(attempt.answers[x.id])))))
  const [confirming, setConfirming] = useState(false)
  const [advance, setAdvance] = useState<{ from: number; ms: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  // ฐานข้อมูลยังไม่มีระบบตรวจทีละข้อ (ยังไม่รัน migration 018): ทำแบบบันทึกแล้วไปต่อแทน
  const [instantOff, setInstantOff] = useState(false)
  const q = qs[index]
  const answeredCount = qs.filter((x) => isAnswered(x, s.answers[x.id])).length
  const lowTime = s.left != null && s.left < 60_000

  useEffect(() => {
    if (!advance) return
    const t = setTimeout(() => {
      setAdvance(null)
      if (advance.from < qs.length - 1) setIndex(advance.from + 1)
      else setConfirming(true)
    }, advance.ms)
    return () => clearTimeout(t)
  }, [advance, qs.length])

  if (!q) return <ErrorBlock message="ชุดนี้ยังไม่มีข้อสอบ" />
  const fb = s.feedback[q.id] ?? null
  const answer = s.answers[q.id]
  const instantQ = instant && !instantOff && q.type !== 'short'
  const busy = checking || advance !== null

  const commit = async (a: Answer) => {
    setCheckError(null)
    if (!instantQ) {
      s.setAnswer(q.id, a)
      setAdvance({ from: index, ms: NEXT_DELAY.saved })
      return
    }
    setChecking(true)
    try {
      const f = await s.check(q.id, a)
      setAdvance({ from: index, ms: (f.points ?? 0) >= 1 ? NEXT_DELAY.right : NEXT_DELAY.wrong })
    } catch (e) {
      const msg = e instanceof ExamError ? e.message : ''
      if (msg.includes('check_exam_answer') || msg === 'instant_check_off') {
        setInstantOff(true)
        s.setAnswer(q.id, a)
        setAdvance({ from: index, ms: NEXT_DELAY.saved })
      } else {
        setCheckError(examErrorText(msg || undefined))
      }
    } finally {
      setChecking(false)
    }
  }
  const onChange = (a: Answer) => {
    if (fb || busy) return
    if (TAP_TO_ANSWER.has(q.type)) void commit(a)
    else s.setAnswer(q.id, a)
  }
  const go = (i: number) => {
    if (busy) return
    setConfirming(false)
    setIndex(i)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="sticky top-14 z-10 flex flex-col gap-2 rounded-2xl bg-white/95 p-3 shadow-md ring-1 ring-brand-100 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 truncate font-display text-brand-900">{attempt.exam.title}</p>
          <span className="text-xs text-slate-500" role="status">
            {s.saveState === 'saving' ? 'กำลังบันทึก…' : s.saveState === 'offline' ? '⚠️ ยังไม่ได้บันทึก (เน็ตหลุด)' : ''}
          </span>
          {s.left != null && (
            <span className={`rounded-full px-3 py-1 font-display tabular-nums ${lowTime ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
              ⏱ {formatClock(s.left)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface shadow-[inset_0_1px_3px_rgb(20_45_100/0.18)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-action to-gold-400 transition-[width] duration-500"
              style={{ width: `${(answeredCount / qs.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-2">
            ข้อ {index + 1}/{qs.length}
          </span>
        </div>
      </header>

      {s.tabSwitches > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">ระบบบันทึกว่าออกจากหน้าสอบ {s.tabSwitches} ครั้ง กรุณาอยู่ในหน้านี้จนส่งข้อสอบ</p>
      )}

      <section
        key={q.id}
        className="tq-verdict relative flex flex-col gap-5 overflow-hidden rounded-3xl bg-gradient-to-b from-white to-brand-50/60 p-5 shadow-raise ring-1 ring-brand-100 sm:p-7"
      >
        <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-action via-brand-400 to-gold-400" aria-hidden />
        <QuestionPrompt no={index + 1} prompt={q.prompt} />
        <QuestionInput
          key={q.id}
          question={q}
          answer={answer}
          onChange={onChange}
          disabled={busy && !fb}
          feedback={fb}
          shuffleSeed={attempt.exam.shuffle_choices ? attempt.attempt_id : null}
        />

        <div aria-live="polite">
          {fb && <Verdict question={q} feedback={fb} />}
          {!instantQ && advance && <p className="tq-verdict font-display text-emerald-700">บันทึกคำตอบแล้ว ✓</p>}
          {checkError && <p className="text-rose-600">{checkError}</p>}
          {advance && (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <span>{advance.from < qs.length - 1 ? 'ไปข้อถัดไป' : 'ไปส่งข้อสอบ'}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <span
                  key={`${advance.from}-${advance.ms}`}
                  className="tq-countdown block h-full rounded-full bg-action"
                  style={{ '--tq-countdown': `${advance.ms}ms` } as CSSProperties}
                />
              </span>
            </div>
          )}
        </div>

        {!fb && !advance && !TAP_TO_ANSWER.has(q.type) && (
          <Button loading={checking} loadingText="กำลังตรวจ…" disabled={!isAnswered(q, answer)} onClick={() => answer && void commit(answer)}>
            {instantQ ? 'ตรวจคำตอบ' : 'ยืนยันคำตอบ ไปข้อถัดไป →'}
          </Button>
        )}
        {fb && !advance && index < qs.length - 1 && (
          <Button variant="secondary" onClick={() => go(index + 1)}>
            ข้อถัดไป →
          </Button>
        )}
      </section>

      <nav aria-label="เลือกข้อ" className="flex flex-wrap items-center gap-2">
        {qs.map((x, i) => {
          const f = s.feedback[x.id]
          const done = isAnswered(x, s.answers[x.id])
          const tone =
            i === index
              ? 'bg-gradient-to-b from-action to-action-strong text-white shadow-action'
              : f
                ? (f.points ?? 0) >= 1
                  ? 'bg-mint-400/30 text-emerald-900 ring-1 ring-mint-500'
                  : 'bg-rose-100 text-rose-800 ring-1 ring-coral-400'
                : done
                  ? 'bg-brand-100 text-brand-800'
                  : 'bg-white text-slate-500 ring-1 ring-brand-100'
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => go(i)}
              disabled={busy}
              aria-current={i === index ? 'step' : undefined}
              aria-label={`ข้อ ${i + 1}${f ? ((f.points ?? 0) >= 1 ? ' ถูก' : ' ผิด') : done ? ' ตอบแล้ว' : ''}`}
              className={`tq-press size-10 rounded-xl font-display text-sm shadow-sm ${tone}`}
            >
              {f ? ((f.points ?? 0) >= 1 ? '✓' : '✗') : i + 1}
            </button>
          )
        })}
        {!confirming && !busy && (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            ส่งข้อสอบ
          </Button>
        )}
      </nav>

      {(confirming || s.submitError) && (
        <section className="tq-verdict rounded-3xl bg-gradient-to-b from-white to-brand-50 p-5 shadow-raise ring-1 ring-brand-200" role="alertdialog" aria-label="ยืนยันส่งข้อสอบ">
          <p className="font-display text-lg text-brand-900">
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

// ผลตรวจข้อนี้: ถูก = เขียวเด้ง · ผิด = แดง พร้อมเฉลยและคำอธิบาย
function Verdict({ question, feedback }: { question: ActiveAttempt['questions'][number]; feedback: Feedback }) {
  const pts = feedback.points ?? 0
  const right = pts >= 1
  return (
    <div
      className={`tq-verdict flex gap-3 rounded-2xl p-4 shadow-md ring-2 ${
        right ? 'bg-gradient-to-br from-emerald-50 to-mint-400/25 ring-mint-500' : 'bg-gradient-to-br from-rose-50 to-rose-100 ring-coral-400'
      }`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full text-xl font-bold text-white shadow-md ${
          right ? 'bg-gradient-to-b from-mint-400 to-mint-500' : 'bg-gradient-to-b from-coral-400 to-rose-600'
        }`}
        aria-hidden
      >
        {right ? '✓' : '✗'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-display text-lg ${right ? 'text-emerald-800' : 'text-rose-700'}`}>
          {right ? 'ถูกต้อง! 🎉' : pts > 0 ? `ถูกบางส่วน (${Math.round(pts * 100)}%)` : 'ยังไม่ถูก'}
        </p>
        {!right && (
          <p className="text-sm text-slate-700">
            เฉลย: <span className="font-semibold text-emerald-800">{describeAnswer(question, feedback.correct)}</span>
          </p>
        )}
        {feedback.explanation && <p className="mt-1 text-sm text-slate-600">💡 {feedback.explanation}</p>}
      </div>
    </div>
  )
}
