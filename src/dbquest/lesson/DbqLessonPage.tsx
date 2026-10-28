import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { NongDataSays } from '@/components/illustrations/NongData'
import { LoadingBlock, ErrorBlock } from '@/components/StatusViews'
import { course, findSession, findUnit, type StepKey } from '@/content/course'
import { loadSessionContent, type SessionContent } from '@/content/lesson'
import type { Json } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { BlockView } from './Blocks'
import { completeStep, DbqError, fetchSessionState, submitWorksheet, type CheckResult, type SessionState } from './dbqLessonApi'
import { QuestionCard } from './QuestionCard'

const STEP_TITLE = Object.fromEntries(course.steps.map((s) => [s.id, s.title])) as Record<StepKey, string>
const STEP_ICON: Record<StepKey, string> = { warmup: '🔔', lesson: '📘', practice: '✍️', game: '🎮', worksheet: '📝', wrapup: '🏁' }

const primaryBtn = 'min-h-12 rounded-2xl bg-dq-600 px-6 font-display text-white shadow-[0_4px_0_0_var(--color-dq-900)] hover:bg-dq-700 disabled:opacity-50 disabled:shadow-none'
const panel = 'space-y-4 rounded-3xl bg-white p-5 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800'
const textArea = 'min-h-28 w-full rounded-2xl border-2 border-dq-200 bg-white px-4 py-3 outline-none focus:border-dq-500 dark:border-dq-700 dark:bg-dq-950'

type Loaded = { kind: 'ok'; content: SessionContent; state: SessionState } | { kind: 'locked' } | { kind: 'no-content' }

async function loadLesson(no: number): Promise<Loaded> {
  const content = await loadSessionContent(no)
  if (!content) return { kind: 'no-content' }
  try {
    return { kind: 'ok', content, state: await fetchSessionState(no) }
  } catch (e) {
    if (e instanceof DbqError && e.code === 'locked') return { kind: 'locked' }
    throw e
  }
}

export function DbqLessonPage() {
  const no = Number(useParams().sessionNo)
  const session = findSession(no)
  const res = useAsync(() => loadLesson(no), [no])

  if (!session) return <NongDataSays mood="think">ไม่พบคาบนี้</NongDataSays>
  const unit = findUnit(session.unit)
  return (
    <div className="space-y-6">
      <header>
        <Link to="/db/map" className="text-base text-dq-700 underline-offset-2 hover:underline dark:text-dq-300">
          ← แผนที่การเรียน
        </Link>
        {unit && (
          <p className="mt-2 text-base text-slate-600 dark:text-dq-300">
            {unit.icon} หน่วย {unit.no} {unit.title}
          </p>
        )}
        <h1 className="text-2xl text-dq-900 dark:text-white">
          คาบ {session.no}: {session.title}
        </h1>
      </header>
      {res.status === 'loading' && <LoadingBlock label="กำลังเปิดบทเรียน…" />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.data?.kind === 'locked' && (
        <NongDataSays mood="think">🔒 คาบนี้ยังล็อกอยู่ ทำคาบก่อนหน้าให้ได้อย่างน้อยตามเกณฑ์ หรือรอครูปลดล็อกให้นะ</NongDataSays>
      )}
      {res.data?.kind === 'no-content' && <NongDataSays mood="think">เนื้อหาคาบนี้กำลังเตรียมอยู่ อีกไม่นานเปิดให้เรียนแน่นอน</NongDataSays>}
      {res.data?.kind === 'ok' && <LessonFlow no={no} content={res.data.content} initial={res.data.state} />}
    </div>
  )
}

function XpToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [xp, onDone])
  return (
    <div role="status" className="fixed inset-x-0 bottom-24 z-20 mx-auto w-fit rounded-full bg-xp-500 px-5 py-2 font-display text-white shadow-lg md:bottom-8">
      +{xp} XP
    </div>
  )
}

function LessonFlow({ no, content, initial }: { no: number; content: SessionContent; initial: SessionState }) {
  const steps = initial.steps
  const [done, setDone] = useState(() => new Set(Object.keys(initial.done) as StepKey[]))
  const [solved, setSolved] = useState(() => new Set(initial.solved))
  const [attempted, setAttempted] = useState(() => new Set(initial.attempted))
  const [pct, setPct] = useState(initial.pct)
  const [current, setCurrent] = useState<StepKey>(() => steps.find((s) => !(s in initial.done)) ?? steps[0] ?? 'wrapup')
  const [toast, setToast] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gainXp = (xp: number) => {
    if (xp > 0) setToast((t) => (t ?? 0) + xp)
  }
  const clearToast = useCallback(() => setToast(null), [])

  const onChecked = (id: string, r: CheckResult) => {
    setAttempted((s) => new Set(s).add(id))
    if (r.correct) setSolved((s) => new Set(s).add(id))
    gainXp(r.xp)
  }

  const finish = async (step: StepKey, data: Json = {}) => {
    setBusy(true)
    setError(null)
    try {
      const r = await completeStep(no, step, data)
      setDone((s) => new Set(s).add(step))
      if (r.pct !== null) setPct(r.pct)
      gainXp(r.xp)
      const next = steps[steps.indexOf(step) + 1]
      if (next) setCurrent(next)
      scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  // เปิดได้: ขั้นที่ทำแล้ว + ขั้นแรกที่ยังไม่ทำ
  const firstOpen = steps.find((s) => !done.has(s))
  const canOpen = (s: StepKey) => done.has(s) || s === firstOpen
  const allDone = steps.every((s) => done.has(s))

  const stepProps = { content, busy, finish, onChecked, solved, attempted, done: done.has(current) }
  return (
    <>
      {initial.preview && (
        <p className="rounded-2xl bg-xp-300/40 px-4 py-2 text-base">โหมดครู: ทำได้ทุกขั้นแต่ไม่บันทึกผล</p>
      )}
      <nav aria-label="ขั้นในคาบ" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-2">
          {steps.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={!canOpen(s)}
                onClick={() => setCurrent(s)}
                aria-current={current === s ? 'step' : undefined}
                className={`flex min-h-12 items-center gap-2 rounded-2xl px-3 font-display text-base ring-2 transition disabled:opacity-40 ${
                  current === s
                    ? 'bg-dq-600 text-white ring-dq-600'
                    : 'bg-white ring-dq-100 hover:ring-dq-300 dark:bg-dq-900 dark:ring-dq-800'
                }`}
              >
                <span aria-hidden>{done.has(s) ? '✅' : STEP_ICON[s]}</span>
                <span>
                  {i + 1}. {STEP_TITLE[s]}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {pct !== null && (
        <div className="flex items-center gap-3 text-base">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-dq-100 dark:bg-dq-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้าคาบนี้">
            <div className="h-full rounded-full bg-xp-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-display">{pct}%</span>
        </div>
      )}

      {current === 'warmup' && <WarmupStep {...stepProps} />}
      {current === 'lesson' && <LessonStep {...stepProps} />}
      {current === 'practice' && <PracticeStep {...stepProps} />}
      {current === 'game' && <GameStep {...stepProps} />}
      {current === 'worksheet' && <WorksheetStep {...stepProps} initialSubmission={initial.submissions[content.worksheet?.item_id ?? '']} />}
      {current === 'wrapup' && <WrapupStep {...stepProps} />}

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </p>
      )}
      {allDone && <SessionDone no={no} />}
      {toast !== null && <XpToast xp={toast} onDone={clearToast} />}
    </>
  )
}

interface StepProps {
  content: SessionContent
  busy: boolean
  done: boolean
  finish: (step: StepKey, data?: Json) => Promise<void>
  onChecked: (id: string, r: CheckResult) => void
  solved: Set<string>
  attempted: Set<string>
}

function StepHeader({ step, children }: { step: StepKey; children?: ReactNode }) {
  const minutes = course.steps.find((s) => s.id === step)?.minutes
  return (
    <div>
      <h2 className="text-xl text-dq-900 dark:text-white">
        {STEP_ICON[step]} {STEP_TITLE[step]}
        {minutes && <span className="ml-2 text-base font-normal text-slate-500 dark:text-dq-300">ประมาณ {minutes} นาที</span>}
      </h2>
      {children && <p className="text-slate-600 dark:text-dq-300">{children}</p>}
    </div>
  )
}

function DoneNote({ children = 'ทำขั้นนี้เสร็จแล้ว' }: { children?: ReactNode }) {
  return <p className="font-display text-emerald-700 dark:text-emerald-300">✓ {children}</p>
}

function WarmupStep({ content, busy, done, finish }: StepProps) {
  const [answers, setAnswers] = useState(() => content.warmup.map(() => ''))
  return (
    <section className={panel}>
      <StepHeader step="warmup">ชวนคิดก่อนเรียน ไม่มีถูกผิด ตอบอย่างน้อย 1 ข้อ</StepHeader>
      {content.warmup.map((q, i) => (
        <label key={i} className="block space-y-2">
          <span className="block">
            {i + 1}. {q}
          </span>
          <textarea
            className={textArea}
            maxLength={500}
            value={answers[i]}
            onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
      {done && <DoneNote />}
      <button type="button" className={primaryBtn} disabled={busy || answers.every((a) => !a.trim())} onClick={() => void finish('warmup', { answers })}>
        {done ? 'บันทึกคำตอบอีกครั้ง' : 'ไปเรียนกันเลย'}
      </button>
    </section>
  )
}

function LessonStep({ content, busy, done, finish, onChecked, solved }: StepProps) {
  // การ์ดถัดไปเปิดเมื่อตอบคำถามท้ายการ์ดก่อนหน้าถูก
  const unlocked = content.cards.findIndex((c) => !solved.has(c.check.id))
  const visible = unlocked === -1 ? content.cards : content.cards.slice(0, unlocked + 1)
  const allSolved = unlocked === -1
  return (
    <section className="space-y-6">
      <StepHeader step="lesson">
        อ่านทีละการ์ด แล้วตอบคำถามท้ายการ์ดให้ถูกเพื่อเปิดการ์ดถัดไป ({Math.min(visible.length, content.cards.length)}/{content.cards.length})
      </StepHeader>
      {visible.map((card, i) => (
        <article key={card.id} className={panel}>
          <h3 className="text-lg text-dq-900 dark:text-white">
            การ์ด {i + 1}: {card.title}
          </h3>
          {card.blocks.map((b, j) => (
            <BlockView key={j} block={b} />
          ))}
          <div className="border-t border-dq-100 pt-4 dark:border-dq-800">
            <p className="mb-2 font-display text-xp-600 dark:text-xp-400">เช็กความเข้าใจ</p>
            <QuestionCard question={card.check} solved={solved.has(card.check.id)} onChecked={onChecked} />
          </div>
        </article>
      ))}
      {allSolved &&
        (done ? (
          <DoneNote />
        ) : (
          <button type="button" className={primaryBtn} disabled={busy} onClick={() => void finish('lesson')}>
            เรียนครบแล้ว ไปขั้นถัดไป
          </button>
        ))}
    </section>
  )
}

function PracticeStep({ content, busy, done, finish, onChecked, solved, attempted }: StepProps) {
  const allTried = content.practice.every((q) => attempted.has(q.id))
  return (
    <section className="space-y-4">
      <StepHeader step="practice">ลองทำทุกข้อ ตอบผิดได้ ตอบใหม่ได้เรื่อย ๆ</StepHeader>
      {content.practice.map((q) => (
        <QuestionCard key={q.id} question={q} solved={solved.has(q.id)} onChecked={onChecked} />
      ))}
      {done ? (
        <DoneNote />
      ) : (
        <button type="button" className={primaryBtn} disabled={busy || !allTried} onClick={() => void finish('practice')}>
          {allTried ? 'ฝึกครบแล้ว ไปขั้นถัดไป' : 'ทำให้ครบทุกข้อก่อนนะ'}
        </button>
      )}
    </section>
  )
}

function GameStep({ content, busy, done, finish }: StepProps) {
  const game = content.game
  if (!game) return null
  return (
    <section className={panel}>
      <StepHeader step="game" />
      <p className="font-display text-xl">{game.title}</p>
      <p>{game.description}</p>
      <Link to={`/db/games/${game.slug}`} className={`${primaryBtn} inline-flex items-center`}>
        เปิดเกม
      </Link>
      {done ? (
        <DoneNote>เล่นเกมแล้ว</DoneNote>
      ) : (
        <div>
          <p className="text-base text-slate-600 dark:text-dq-300">เล่นจบแล้วกลับมากดปุ่มนี้</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void finish('game')}
            className="mt-2 min-h-12 rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 hover:bg-dq-50 dark:text-dq-200 dark:ring-dq-700 dark:hover:bg-dq-800"
          >
            เล่นจบแล้ว ไปขั้นถัดไป
          </button>
        </div>
      )}
    </section>
  )
}

function WorksheetStep({ content, busy, done, finish, initialSubmission }: StepProps & { initialSubmission?: SessionState['submissions'][string] }) {
  const ws = content.worksheet
  const [text, setText] = useState(initialSubmission?.content.text ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!ws) return null
  const graded = initialSubmission?.graded_at != null

  const onSubmit = async () => {
    setSending(true)
    setError(null)
    try {
      await submitWorksheet(ws.item_id, text)
      await finish('worksheet')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={panel}>
      <StepHeader step="worksheet" />
      <h3 className="text-lg text-dq-900 dark:text-white">
        {ws.title} <span className="text-base font-normal text-slate-500 dark:text-dq-300">({ws.max_score} คะแนน)</span>
      </h3>
      <div className="whitespace-pre-line">{ws.instructions}</div>
      {graded && initialSubmission ? (
        <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/50">
          <p className="font-display">
            ครูตรวจแล้ว: {initialSubmission.score ?? '-'} / {initialSubmission.max_score}
          </p>
          {initialSubmission.feedback && <p className="mt-1">💬 {initialSubmission.feedback}</p>}
        </div>
      ) : null}
      <textarea
        className={`${textArea} min-h-48`}
        aria-label="คำตอบใบงาน"
        maxLength={10000}
        disabled={graded}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="text-rose-600 dark:text-rose-300">{error}</p>}
      {done && <DoneNote>ส่งใบงานแล้ว แก้แล้วส่งใหม่ได้จนกว่าครูจะตรวจ</DoneNote>}
      {!graded && (
        <button type="button" className={primaryBtn} disabled={busy || sending || !text.trim()} onClick={() => void onSubmit()}>
          {sending ? 'กำลังส่ง…' : done ? 'ส่งฉบับแก้ไข' : 'ส่งใบงาน'}
        </button>
      )}
    </section>
  )
}

function WrapupStep({ content, busy, done, finish }: StepProps) {
  const [reflection, setReflection] = useState('')
  return (
    <section className={panel}>
      <StepHeader step="wrapup" />
      <p className="font-display">สรุป 3 ข้อของคาบนี้</p>
      <ol className="list-decimal space-y-1 pl-6">
        {content.summary.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <label className="block space-y-2">
        <span className="block font-display">วันนี้เราได้เรียนรู้อะไร หรือยังสงสัยอะไรอยู่</span>
        <textarea className={textArea} maxLength={1000} value={reflection} onChange={(e) => setReflection(e.target.value)} />
      </label>
      {done && <DoneNote />}
      <button type="button" className={primaryBtn} disabled={busy || !reflection.trim()} onClick={() => void finish('wrapup', { reflection })}>
        {done ? 'บันทึกอีกครั้ง' : 'จบคาบ'}
      </button>
    </section>
  )
}

function SessionDone({ no }: { no: number }) {
  const next = findSession(no + 1)
  return (
    <NongDataSays mood="cheer">
      <p className="font-display text-xl">เยี่ยมมาก! เรียนครบทุกขั้นของคาบ {no} แล้ว 🎉</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {next && (
          <Link to={`/db/lesson/${next.no}`} className={`${primaryBtn} inline-flex items-center`}>
            ไปคาบ {next.no}
          </Link>
        )}
        <Link to="/db/map" className="inline-flex min-h-12 items-center rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 dark:text-dq-200 dark:ring-dq-700">
          กลับแผนที่
        </Link>
      </div>
    </NongDataSays>
  )
}
