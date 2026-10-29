import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CircleCheck,
  ClipboardList,
  Flag,
  Gamepad2,
  Lock,
  type LucideIcon,
  MessageSquare,
  PartyPopper,
  PencilLine,
  Sparkles,
  Target,
} from 'lucide-react'
import { NongData, NongDataSays } from '@/components/illustrations/NongData'
import { StepJourney } from '@/components/StepJourney'
import { LoadingBlock, ErrorBlock } from '@/components/StatusViews'
import { course, findSession, findUnit, type StepKey } from '@/content/course'
import { loadSessionContent, type SessionContent } from '@/content/lesson'
import type { Json } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { BlockView } from './Blocks'
import { DbqMarkdown } from './DbqMarkdown'
import { completeStep, DbqError, fetchSessionState, submitWorksheet, type CheckResult, type SessionState } from './dbqLessonApi'
import { GameView } from '../games/DbqGamePage'
import { QuestionCard } from './QuestionCard'

const STEP_TITLE = Object.fromEntries(course.steps.map((s) => [s.id, s.title])) as Record<StepKey, string>
const STEP_ICON: Record<StepKey, LucideIcon> = {
  warmup: Bell,
  lesson: BookOpen,
  practice: PencilLine,
  game: Gamepad2,
  worksheet: ClipboardList,
  wrapup: Flag,
}

const primaryBtn =
  'min-h-12 rounded-2xl tq-press bg-action px-6 font-semibold text-white shadow-action hover:-translate-y-px hover:bg-brand-600 disabled:opacity-50 disabled:shadow-none'
const navBtn =
  'min-h-12 rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 hover:bg-dq-50 disabled:opacity-50 dark:text-dq-200 dark:ring-dq-700 dark:hover:bg-dq-800'
const panel = 'space-y-4 rounded-3xl bg-white p-5 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800'
const textArea =
  'min-h-28 w-full rounded-2xl border-2 border-dq-200 bg-white px-4 py-3 outline-none focus:border-dq-500 dark:border-dq-700 dark:bg-dq-950'

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
  // ?after=game: กลับมาจากเกม => เปิดขั้นถัดจากเกม
  const after = useSearchParams()[0].get('after') as StepKey | null
  const session = findSession(no)
  const res = useAsync(() => loadLesson(no), [no])

  if (!session) return <NongDataSays mood="think">ไม่พบคาบนี้</NongDataSays>
  const unit = findUnit(session.unit)
  return (
    <div className="space-y-6">
      <header>
        <Link to="/db/map" className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-ink-2 hover:text-ink dark:text-dq-300">
          <ArrowLeft className="size-4" aria-hidden /> บทเรียนทั้งหมด
        </Link>
        <h1 className="mt-1 text-[1.45rem] leading-tight text-ink sm:text-[2.1rem] dark:text-white">
          คาบ {session.no}: {session.title}
        </h1>
        {unit && (
          <p className="mt-1 text-base text-ink-2 dark:text-dq-300">
            หน่วย {unit.no} · {unit.title}
          </p>
        )}
      </header>
      {res.status === 'loading' && <LoadingBlock label="กำลังเปิดบทเรียน…" />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.data?.kind === 'locked' && (
        <NongDataSays mood="think">
          <Lock className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> คาบนี้ยังล็อกอยู่ ทำคาบก่อนหน้าให้ได้อย่างน้อยตามเกณฑ์
          หรือรอครูปลดล็อกให้นะ
        </NongDataSays>
      )}
      {res.data?.kind === 'no-content' && <NongDataSays mood="think">เนื้อหาคาบนี้กำลังเตรียมอยู่ อีกไม่นานเปิดให้เรียนแน่นอน</NongDataSays>}
      {res.data?.kind === 'ok' && (
        <LessonFlow key={`${no}:${after ?? ''}`} no={no} content={res.data.content} initial={res.data.state} after={after} />
      )}
    </div>
  )
}

function XpToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [xp, onDone])
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-20 mx-auto w-fit rounded-full bg-xp-500 px-5 py-2 font-display text-white shadow-lg md:bottom-8"
    >
      +{xp} XP
    </div>
  )
}

function LessonFlow({ no, content, initial, after }: { no: number; content: SessionContent; initial: SessionState; after: StepKey | null }) {
  const steps = initial.steps
  const [done, setDone] = useState(() => new Set(Object.keys(initial.done) as StepKey[]))
  const [solved, setSolved] = useState(() => new Set(initial.solved))
  const [attempted, setAttempted] = useState(() => new Set(initial.attempted))
  const [current, setCurrent] = useState<StepKey>(() => {
    const i = after ? steps.indexOf(after) : -1
    if (i >= 0) return steps[Math.min(i + 1, steps.length - 1)] ?? 'wrapup'
    return steps.find((s) => !(s in initial.done)) ?? steps[0] ?? 'wrapup'
  })
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

  const markDone = (step: StepKey, xp: number) => {
    setDone((s) => new Set(s).add(step))
    gainXp(xp)
  }
  const goNext = (step: StepKey) => {
    const next = steps[steps.indexOf(step) + 1]
    if (next) setCurrent(next)
    scrollTo({ top: 0, behavior: 'smooth' })
  }

  const finish = async (step: StepKey, data: Json = {}) => {
    setBusy(true)
    setError(null)
    try {
      const r = await completeStep(no, step, data)
      markDone(step, r.xp)
      goNext(step)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const allDone = steps.every((s) => done.has(s))

  // คำตอบที่นักเรียนเดาไว้ตอนเปิดคาบ (ใช้ย้อนดูตอนปิดคาบ)
  const [guess, setGuess] = useState(() => {
    const w = initial.done.warmup as { guess?: unknown } | undefined
    return typeof w?.guess === 'string' ? w.guess : ''
  })
  const nextStep = steps[steps.indexOf(current) + 1]
  const stepProps = {
    content,
    busy,
    finish,
    onChecked,
    solved,
    attempted,
    done: done.has(current),
    preview: initial.preview,
  }
  return (
    <>
      {initial.preview && <p className="rounded-2xl bg-xp-300/40 px-4 py-2 text-base">โหมดครู: ทำได้ทุกขั้นแต่ไม่บันทึกผล</p>}
      <StepJourney
        steps={steps.map((s) => ({ key: s, label: STEP_TITLE[s], icon: STEP_ICON[s] }))}
        current={current}
        done={done}
        onSelect={(k) => setCurrent(k as StepKey)}
      />

      {current === 'warmup' && <WarmupStep {...stepProps} guess={guess} onGuess={setGuess} />}
      {current === 'lesson' && <LessonStep {...stepProps} />}
      {current === 'practice' && <PracticeStep {...stepProps} />}
      {current === 'game' && (
        <GameStep {...stepProps} markDone={markDone} goNext={goNext} nextTitle={nextStep && STEP_TITLE[nextStep]} />
      )}
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
  preview: boolean
}

function StepHeader({ step, children }: { step: StepKey; children?: ReactNode }) {
  return (
    <div>
      <h2 className="text-xl text-dq-900 dark:text-white">
        <StepIcon step={step} /> {STEP_TITLE[step]}
      </h2>
      {children && <p className="text-slate-600 dark:text-dq-300">{children}</p>}
    </div>
  )
}

function DoneNote({ children = 'ทำขั้นนี้เสร็จแล้ว' }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 font-semibold text-mint-500 dark:text-emerald-300">
      <CircleCheck className="size-5" aria-hidden /> {children}
    </p>
  )
}

function Intro({ intro }: { intro: NonNullable<SessionContent['intro']> }) {
  return (
    <>
      <div className="relative overflow-hidden rounded-[1.5rem] bg-db-600 p-5 pr-24 text-white sm:p-6 sm:pr-32">
        <NongData mood="think" className="pointer-events-none absolute -bottom-3 -right-3 size-28 drop-shadow-lg sm:size-32" />
        <p className="text-sm font-semibold text-db-100">คำถามก่อนเรียน</p>
        <p className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{intro.bigQuestion}</p>
      </div>
      {(intro.why || intro.goals) && (
        <div className="grid gap-4 md:grid-cols-2">
          {intro.why && (
            <div className="rounded-[1.25rem] bg-surface/70 p-4 dark:bg-dq-950">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink dark:text-white">
                <Sparkles className="size-5 text-xp-500" aria-hidden /> เรียนไปทำไม
              </p>
              <DbqMarkdown text={intro.why} />
            </div>
          )}
          {intro.goals && (
            <div className="rounded-[1.25rem] bg-surface/70 p-4 dark:bg-dq-950">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink dark:text-white">
                <Target className="size-5 text-action" aria-hidden /> จบคาบนี้ เราจะ…
              </p>
              <ol className="space-y-2">
                {intro.goals.map((g, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-db-50 text-sm font-bold text-db-700 dark:bg-db-700/30 dark:text-db-100">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{g}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function WarmupStep({ content, busy, done, finish, guess, onGuess }: StepProps & { guess: string; onGuess: (g: string) => void }) {
  const [answers, setAnswers] = useState(() => content.warmup.map(() => ''))
  const [g, setG] = useState(guess)
  const intro = content.intro
  const filled = !!g.trim() || answers.some((a) => a.trim())
  const onSave = () => {
    onGuess(g)
    void finish('warmup', { guess: g, answers: [g, ...answers] })
  }
  return (
    <section className={panel}>
      <StepHeader step="warmup">{intro ? 'ตอบตามที่คิด ไม่มีถูกผิด' : 'ชวนคิดก่อนเรียน ไม่มีถูกผิด ตอบอย่างน้อย 1 ข้อ'}</StepHeader>
      {intro && (
        <>
          <Intro intro={intro} />
          <label className="block space-y-2">
            <span className="block font-semibold">คำตอบของฉัน (ก่อนเรียน)</span>
            <textarea
              className={textArea}
              maxLength={500}
              placeholder="ตอบสั้น ๆ ตามที่คิด ท้ายคาบจะกลับมาดูกันอีกที"
              value={g}
              onChange={(e) => setG(e.target.value)}
            />
          </label>
          {content.warmup.length > 0 && <p className="pt-2 font-semibold text-ink dark:text-white">ชวนคิดเพิ่ม (ตอบข้อไหนก็ได้)</p>}
        </>
      )}
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
      <button type="button" className={primaryBtn} disabled={busy || !filled} onClick={onSave}>
        {done ? 'บันทึกคำตอบอีกครั้ง' : 'ไปเรียนกันเลย'}
      </button>
    </section>
  )
}

function LessonStep({ content, busy, done, finish, onChecked, solved }: StepProps) {
  // แสดงทีละการ์ด: ตอบคำถามท้ายการ์ดถูก การ์ดถัดไปจะมาแทนที่
  const cards = content.cards
  const firstUnsolved = cards.findIndex((c) => !solved.has(c.check.id))
  const allSolved = firstUnsolved === -1
  const [idx, setIdx] = useState(() => Math.max(firstUnsolved, 0))
  const [advanceFrom, setAdvanceFrom] = useState<number | null>(null)
  const top = useRef<HTMLElement>(null)
  const card = cards[idx]!
  const isLast = idx === cards.length - 1
  const canNext = !isLast && solved.has(card.check.id)

  const go = useCallback((i: number) => {
    setIdx(i)
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // ตอบถูกแล้วรอให้เห็นผลสักครู่ก่อนเปลี่ยนการ์ด
  useEffect(() => {
    if (advanceFrom === null) return
    const t = setTimeout(() => {
      setAdvanceFrom(null)
      go(advanceFrom + 1)
    }, 1200)
    return () => clearTimeout(t)
  }, [advanceFrom, go])

  const onCardChecked = (id: string, r: CheckResult) => {
    onChecked(id, r)
    if (r.correct && !isLast) setAdvanceFrom(idx)
  }

  return (
    <section ref={top} className="scroll-mt-4 space-y-6">
      <StepHeader step="lesson">
        ตอบคำถามท้ายการ์ดถูก จะไปการ์ดถัดไป (การ์ด {idx + 1}/{cards.length})
      </StepHeader>
      <article key={card.id} className={panel}>
        <h3 className="text-lg text-dq-900 dark:text-white">
          การ์ด {idx + 1}: {card.title}
        </h3>
        {card.blocks.map((b, j) => (
          <BlockView key={j} block={b} />
        ))}
        <div className="border-t border-dq-100 pt-4 dark:border-dq-800">
          <p className="mb-2 font-display text-xp-600 dark:text-xp-400">เช็กความเข้าใจ</p>
          <QuestionCard question={card.check} solved={solved.has(card.check.id)} onChecked={onCardChecked} />
        </div>
      </article>
      <div className="flex flex-wrap items-center gap-3">
        {idx > 0 && (
          <button type="button" className={navBtn} disabled={advanceFrom !== null} onClick={() => go(idx - 1)}>
            ← การ์ดก่อนหน้า
          </button>
        )}
        {canNext && (
          <button type="button" className={navBtn} disabled={advanceFrom !== null} onClick={() => go(idx + 1)}>
            การ์ดถัดไป →
          </button>
        )}
      </div>
      {allSolved &&
        isLast &&
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
      <StepHeader step="practice">ทำให้ครบทุกข้อ ตอบผิดแก้ใหม่ได้</StepHeader>
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

function GameStep({
  content,
  busy,
  done,
  finish,
  markDone,
  goNext,
  nextTitle,
}: StepProps & { markDone: (step: StepKey, xp: number) => void; goNext: (step: StepKey) => void; nextTitle?: string }) {
  const game = content.game
  if (!game) return null
  return (
    <section className="space-y-4">
      <StepHeader step="game">{game.description}</StepHeader>
      {done && <DoneNote>เล่นเกมแล้ว เล่นซ้ำเพื่อเก็บดาวเพิ่มได้</DoneNote>}
      <GameView
        gameKey={game.slug}
        embedded={{
          onStepDone: (xp) => markDone('game', xp),
          nextLabel: nextTitle ? `เล่นจบแล้ว ไปขั้น${nextTitle}` : 'เล่นจบแล้ว',
          // โหมดครูไม่บันทึกขั้นเกมตอนเล่นจบ จึงให้ปุ่มนี้บันทึกแทน
          onNext: () => (done ? goNext('game') : void finish('game')),
        }}
      />
      {done && (
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => goNext('game')}>
          {nextTitle ? `ไปขั้น${nextTitle}` : 'ไปขั้นถัดไป'}
        </button>
      )}
    </section>
  )
}

function WorksheetStep({
  content,
  busy,
  done,
  finish,
  preview,
  initialSubmission,
}: StepProps & { initialSubmission?: SessionState['submissions'][string] }) {
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
      // ครูดูตัวอย่าง: ไม่ส่งจริง (เซิร์ฟเวอร์รับใบงานจากนักเรียนเท่านั้น)
      if (!preview) await submitWorksheet(ws.item_id, text)
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
          {initialSubmission.feedback && (
            <p className="mt-1 flex gap-1.5">
              <MessageSquare className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden /> {initialSubmission.feedback}
            </p>
          )}
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

function WrapupStep({ content, busy, done, finish, onChecked, solved, attempted }: StepProps) {
  const closing = content.closing
  const [reflection, setReflection] = useState('')

  if (!closing) {
    // คาบที่ยังไม่มีภารกิจปิดคาบ: สรุป + เขียนสิ่งที่ได้เรียนรู้
    return (
      <section className={panel}>
        <StepHeader step="wrapup" />
        <p className="font-semibold">สรุป 3 ข้อของคาบนี้</p>
        <ol className="list-decimal space-y-1 pl-6">
          {content.summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <label className="block space-y-2">
          <span className="block font-semibold">วันนี้เราได้เรียนรู้อะไร หรือยังสงสัยอะไรอยู่</span>
          <textarea className={textArea} maxLength={1000} value={reflection} onChange={(e) => setReflection(e.target.value)} />
        </label>
        {done && <DoneNote />}
        <button type="button" className={primaryBtn} disabled={busy || !reflection.trim()} onClick={() => void finish('wrapup', { reflection })}>
          {done ? 'บันทึกอีกครั้ง' : 'จบคาบ'}
        </button>
      </section>
    )
  }

  const total = closing.questions.length
  const tried = closing.questions.filter((q) => attempted.has(q.id)).length
  const right = closing.questions.filter((q) => solved.has(q.id)).length
  const allTried = tried === total

  return (
    <section className="space-y-4">
      <StepHeader step="wrapup">ใช้ทุกเรื่องที่เรียนวันนี้ ตอบผิดแก้ใหม่ได้</StepHeader>
      <div className={panel}>
        <h3 className="flex items-center gap-2 text-lg text-ink dark:text-white">
          <Flag className="size-5 text-action" aria-hidden /> {closing.title}
        </h3>
        {closing.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
      {closing.questions.map((q, i) => (
        <div key={q.id}>
          <p className="mb-1.5 text-sm font-semibold text-ink-2 dark:text-dq-300">
            ข้อ {i + 1} จาก {total}
          </p>
          <QuestionCard question={q} solved={solved.has(q.id)} onChecked={onChecked} />
        </div>
      ))}
      <div className={`${panel} flex flex-wrap items-center gap-3`}>
        <p className="min-w-0 flex-1">
          ตอบแล้ว{' '}
          <span className="font-semibold tabular-nums">
            {tried}/{total}
          </span>{' '}
          ข้อ · ถูก <span className="font-semibold tabular-nums text-mint-500">{right}</span> ข้อ
          {allTried && right < total && (
            <span className="block text-base text-ink-2 dark:text-dq-300">ข้อที่ยังไม่ถูก ลองอ่านคำใบ้แล้วตอบใหม่ได้</span>
          )}
        </p>
        {done ? (
          <DoneNote />
        ) : (
          <button type="button" className={primaryBtn} disabled={busy || !allTried} onClick={() => void finish('wrapup', {})}>
            {allTried ? 'จบคาบ' : 'ตอบให้ครบทุกข้อก่อน'}
          </button>
        )}
      </div>
    </section>
  )
}

function SessionDone({ no }: { no: number }) {
  const next = findSession(no + 1)
  return (
    <NongDataSays mood="cheer">
      <p className="font-display text-xl">
        เยี่ยมมาก! เรียนครบทุกขั้นของคาบ {no} แล้ว <PartyPopper className="inline size-6 shrink-0 align-[-0.2em]" aria-hidden />
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {next && (
          <Link to={`/db/lesson/${next.no}`} className={`${primaryBtn} inline-flex items-center`}>
            ไปคาบ {next.no}
          </Link>
        )}
        <Link
          to="/db/map"
          className="inline-flex min-h-12 items-center rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 dark:text-dq-200 dark:ring-dq-700"
        >
          กลับไปหน้าบทเรียน
        </Link>
      </div>
    </NongDataSays>
  )
}

function StepIcon({ step, done = false }: { step: StepKey; done?: boolean }) {
  const Icon = done ? CircleCheck : STEP_ICON[step]
  return <Icon className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden />
}
