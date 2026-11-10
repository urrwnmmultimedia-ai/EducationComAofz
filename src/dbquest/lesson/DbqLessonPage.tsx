import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
import { loadSessionContent, type GuideSlot, type SessionContent } from '@/content/lesson'
import type { Json } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { BlockView } from './Blocks'
import { DbqMarkdown } from './DbqMarkdown'
import { completeStep, DbqError, fetchSessionState, submitWorksheet, type CheckResult, type SessionState } from './dbqLessonApi'
import { GameView } from '../games/DbqGamePage'
import { QuestionCard } from './QuestionCard'
import { QuizRunner } from './QuizRunner'
import { RecapBoard } from './widgets'
import { TableWorksheetEditor } from './TableWorksheet'
import { WorksheetWizard } from './WorksheetWizard'
import { loadSheet, missingParts, serializeSheet } from './tableSheetModel'
import { composeGuide, FREE_SLOT, savedSlots } from './warmupGuide'

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
// คาบแบบใหม่ (มีช่องไกด์เปิดคาบ): ทุกขั้นเป็นเวทีมีมิติ การ์ดนูน หัวขั้นเป็นลูกแก้วไอคอน
const Deluxe = createContext<{ on: boolean; steps: StepKey[] }>({ on: false, steps: [] })
const deepPanel = 'tq-raised space-y-4 p-5 sm:p-6'
function usePanel() {
  return useContext(Deluxe).on ? deepPanel : panel
}

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
          <Lock className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> คาบนี้ยังล็อกอยู่ รอครูปลดล็อกในชั่วโมงเรียนนะ
        </NongDataSays>
      )}
      {res.data?.kind === 'no-content' && <NongDataSays mood="think">เนื้อหาคาบนี้กำลังเตรียมอยู่ อีกไม่นานเปิดให้เรียนแน่นอน</NongDataSays>}
      {res.data?.kind === 'ok' && (
        <LessonFlow key={`${no}:${after ?? ''}`} no={no} content={res.data.content} initial={res.data.state} after={after} />
      )}
    </div>
  )
}

function LessonFlow({ no, content, initial, after }: { no: number; content: SessionContent; initial: SessionState; after: StepKey | null }) {
  const steps = initial.steps
  const [done, setDone] = useState(() => new Set(Object.keys(initial.done) as StepKey[]))
  const [solved, setSolved] = useState(() => new Set(initial.solved))
  const [attempted, setAttempted] = useState(() => new Set(initial.attempted))
  // ต้องผ่านทีละขั้น: ไปได้ถึงขั้นแรกที่ยังไม่ผ่านเท่านั้น (โหมดครูไปได้ทุกขั้น)
  const firstOpen = steps.findIndex((s) => !done.has(s))
  const reachable = (s: StepKey) => initial.preview || firstOpen < 0 || steps.indexOf(s) <= firstOpen
  const [picked, setCurrent] = useState<StepKey>(() => {
    const i = after ? steps.indexOf(after) : -1
    if (i >= 0) return steps[Math.min(i + 1, steps.length - 1)] ?? 'wrapup'
    return steps.find((s) => !(s in initial.done)) ?? steps[0] ?? 'wrapup'
  })
  const current = reachable(picked) ? picked : (steps[firstOpen] ?? picked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChecked = (id: string, r: CheckResult) => {
    setAttempted((s) => new Set(s).add(id))
    if (r.correct) setSolved((s) => new Set(s).add(id))
  }

  const markDone = (step: StepKey) => {
    setDone((s) => new Set(s).add(step))
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
      await completeStep(no, step, data)
      markDone(step)
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
  const deluxe = !!content.intro?.guide?.length
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
        locked={new Set(steps.filter((s) => !reachable(s)))}
        onSelect={(k) => reachable(k as StepKey) && setCurrent(k as StepKey)}
      />

      <Deluxe.Provider value={{ on: deluxe, steps }}>
        <StepStage key={current}>
          {current === 'warmup' && <WarmupStep {...stepProps} guess={guess} onGuess={setGuess} saved={initial.done.warmup} />}
          {current === 'lesson' && <LessonStep {...stepProps} />}
          {current === 'practice' && <PracticeStep {...stepProps} />}
          {current === 'game' && (
            <GameStep {...stepProps} markDone={markDone} goNext={goNext} nextTitle={nextStep && STEP_TITLE[nextStep]} />
          )}
          {current === 'worksheet' && <WorksheetStep {...stepProps} initialSubmission={initial.submissions[content.worksheet?.item_id ?? '']} />}
          {current === 'wrapup' && <WrapupStep {...stepProps} guess={guess} />}
        </StepStage>
      </Deluxe.Provider>

      {error && (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </p>
      )}
      {allDone && <SessionDone no={no} />}
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

// เวทีของขั้น: เลื่อนขึ้นพร้อมเอียงเข้าหาจอเล็กน้อยตอนเปลี่ยนขั้น
function StepStage({ children }: { children: ReactNode }) {
  if (!useContext(Deluxe).on) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotateX: 10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200 }}
      className="tq-stage p-3 sm:p-6"
    >
      {children}
    </motion.div>
  )
}

function StepHeader({ step, children }: { step: StepKey; children?: ReactNode }) {
  const { on, steps } = useContext(Deluxe)
  if (on) {
    const Icon = STEP_ICON[step]
    return (
      <div className="flex items-center gap-3">
        <span className="tq-orb grid size-12 shrink-0 place-items-center rounded-full sm:size-14" aria-hidden>
          <Icon className="size-6 sm:size-7" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-action dark:text-dq-300">ขั้นที่ {steps.indexOf(step) + 1}</p>
          <h2 className="text-xl leading-tight text-dq-900 sm:text-2xl dark:text-white">{STEP_TITLE[step]}</h2>
          {children && <p className="text-slate-600 dark:text-dq-300">{children}</p>}
        </div>
      </div>
    )
  }
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

type WarmupProps = StepProps & { guess: string; onGuess: (g: string) => void; saved?: unknown }

function WarmupStep(props: WarmupProps) {
  return props.content.intro?.guide?.length ? <GuidedWarmup {...props} /> : <PlainWarmup {...props} />
}

// กล่องคำถาม 1 ข้อ: ป้ายบอกว่าต้องเขียนอะไร + ประโยคตัวอย่างในช่อง
function GuideBox({
  no,
  question,
  slots,
  values,
  required,
  onChange,
}: {
  no: ReactNode
  question: ReactNode
  slots: GuideSlot[]
  values: string[]
  required: boolean
  onChange: (j: number, v: string) => void
}) {
  const filled = values.filter((v) => v.trim()).length
  return (
    <fieldset className="tq-raised overflow-hidden">
      <legend className="sr-only">{question}</legend>
      <div className="tq-banner flex items-center gap-3 px-4 py-3 text-white">
        <span className="tq-orb grid size-9 shrink-0 place-items-center rounded-full font-display" aria-hidden>
          {no}
        </span>
        <p className="min-w-0 flex-1 font-semibold leading-snug">{question}</p>
      </div>
      <div className="space-y-3 p-4">
        {slots.map((s, j) => {
          const v = values[j] ?? ''
          return (
            <label key={s.label} className="block space-y-1.5">
              <span className="flex items-center gap-2 font-display text-dq-900 dark:text-white">
                {s.label}
                {v.trim() && <CircleCheck className="size-4 text-mint-500" aria-hidden />}
              </span>
              <textarea
                className={`${textArea} min-h-20 ${v.trim() ? 'border-mint-400 dark:border-emerald-600' : ''}`}
                maxLength={160}
                placeholder={s.hint ?? ''}
                value={v}
                onChange={(e) => onChange(j, e.target.value)}
              />
            </label>
          )
        })}
        <p className={`text-base ${filled === slots.length ? 'text-mint-500 dark:text-emerald-300' : 'text-slate-500 dark:text-dq-300'}`}>
          ตอบแล้ว {filled}/{slots.length} ช่อง{required ? '' : ' · ข้อนี้ไม่บังคับ'}
        </p>
      </div>
    </fieldset>
  )
}

function GuidedWarmup({ content, busy, done, finish, onGuess, saved }: WarmupProps) {
  const intro = content.intro!
  const bigSlots = intro.guide ?? [FREE_SLOT]
  const extraSlots = content.warmup.map((_, i) => {
    const g = content.warmupGuide?.[i]
    return g?.length ? g : [FREE_SLOT]
  })
  const [vals, setVals] = useState(() => savedSlots(saved, [bigSlots.length, ...extraSlots.map((s) => s.length)]))
  const set = (i: number, j: number, v: string) => setVals((all) => all.map((row, a) => (a === i ? row.map((x, b) => (b === j ? v : x)) : row)))
  const big = vals[0] ?? []
  const bigDone = big.filter((v) => v.trim()).length
  const ready = bigDone === bigSlots.length
  const onSave = () => {
    const guess = composeGuide(bigSlots, big)
    onGuess(guess)
    // เซิร์ฟเวอร์รับข้อมูลขั้นละไม่เกิน 8000 ไบต์: คำตอบข้ออื่นเก็บใน slots อย่างเดียว ไม่ซ้ำ
    void finish('warmup', { guess, answers: [guess], slots: vals })
  }
  return (
    <section className="space-y-5">
      <StepHeader step="warmup">ตอบตามที่คิด ไม่มีถูกผิด เขียนตามป้ายในแต่ละช่อง</StepHeader>
      <Intro intro={intro} />
      <ol className="grid gap-2 sm:grid-cols-3">
        {['อ่านคำถามในแถบสีน้ำเงิน', 'เขียนตามป้ายทีละช่อง ใช้ประโยคตัวอย่างช่วยเริ่ม', 'คำถามแรกต้องตอบครบ ข้ออื่นตอบเพิ่มได้'].map((t, i) => (
          <li key={t} className="tq-raised flex items-start gap-3 p-3">
            <span className="tq-orb grid size-8 shrink-0 place-items-center rounded-full font-display text-sm" aria-hidden>
              {i + 1}
            </span>
            <span className="text-base leading-snug">{t}</span>
          </li>
        ))}
      </ol>
      <GuideBox no="★" question={intro.bigQuestion} slots={bigSlots} values={big} required onChange={(j, v) => set(0, j, v)} />
      {content.warmup.length > 0 && <p className="pt-1 font-display text-lg text-ink dark:text-white">ชวนคิดเพิ่ม</p>}
      {content.warmup.map((q, i) => (
        <GuideBox key={q} no={i + 1} question={q} slots={extraSlots[i]!} values={vals[i + 1] ?? []} required={false} onChange={(j, v) => set(i + 1, j, v)} />
      ))}
      <div className="tq-raised flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-0 flex-1">
          {ready ? (
            <span className="font-semibold text-mint-500 dark:text-emerald-300">คำถามแรกตอบครบแล้ว พร้อมเรียน!</span>
          ) : (
            <>
              คำถามแรกตอบแล้ว{' '}
              <span className="font-semibold tabular-nums">
                {bigDone}/{bigSlots.length}
              </span>{' '}
              ช่อง
            </>
          )}
        </p>
        {done && <DoneNote />}
        <button type="button" className={primaryBtn} disabled={busy || !ready} onClick={onSave}>
          {done ? 'บันทึกคำตอบอีกครั้ง' : 'ไปเรียนกันเลย'}
        </button>
      </div>
    </section>
  )
}

function PlainWarmup({ content, busy, done, finish, guess, onGuess }: WarmupProps) {
  const P = usePanel()
  const [answers, setAnswers] = useState(() => content.warmup.map(() => ''))
  const [g, setG] = useState(guess)
  const intro = content.intro
  const filled = !!g.trim() || answers.some((a) => a.trim())
  const onSave = () => {
    onGuess(g)
    void finish('warmup', { guess: g, answers: [g, ...answers] })
  }
  return (
    <section className={P}>
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

  const deluxe = useContext(Deluxe).on
  const open = (i: number) => cards.slice(0, i).every((c) => solved.has(c.check.id))

  return (
    <section ref={top} className="scroll-mt-4 space-y-6">
      <StepHeader step="lesson">
        ตอบคำถามท้ายการ์ดถูก จะไปการ์ดถัดไป (การ์ด {idx + 1}/{cards.length})
      </StepHeader>
      {deluxe && (
        <>
          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              ['📖', 'อ่านการ์ด ดูภาพและตาราง'],
              ['👆', 'ลองเล่นกิจกรรมในการ์ด'],
              ['✅', 'ตอบ “เช็กความเข้าใจ” ให้ถูก'],
            ].map(([icon, t], i) => (
              <li key={t} className="tq-raised flex items-center gap-3 p-3">
                <span className="tq-orb grid size-9 shrink-0 place-items-center rounded-full text-lg" aria-hidden>
                  {icon}
                </span>
                <span className="text-base leading-snug">
                  <span className="font-display text-action dark:text-dq-300">{i + 1}. </span>
                  {t}
                </span>
              </li>
            ))}
          </ol>
          <nav aria-label="การ์ดในบทเรียน" className="flex gap-2 overflow-x-auto pb-1">
            {cards.map((c, i) => {
              const ok = solved.has(c.check.id)
              const can = open(i) && advanceFrom === null
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!can}
                  aria-current={i === idx ? 'step' : undefined}
                  onClick={() => go(i)}
                  className={`flex min-h-14 min-w-40 flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-left transition ${
                    i === idx
                      ? 'bg-action text-white shadow-action'
                      : ok
                        ? 'bg-emerald-50 text-emerald-900 ring-1 ring-mint-400 dark:bg-emerald-950/40 dark:text-emerald-100'
                        : 'bg-white text-dq-700 ring-1 ring-dq-200 disabled:opacity-55 dark:bg-dq-900 dark:text-dq-200 dark:ring-dq-700'
                  }`}
                >
                  <span className="text-2xl" aria-hidden>
                    {ok ? '✅' : can ? (c.icon ?? '📘') : '🔒'}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-sm opacity-80">การ์ด {i + 1}</span>
                    <span className="line-clamp-1 font-display">{c.title}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </>
      )}
      <motion.article
        key={card.id}
        initial={deluxe ? { opacity: 0, rotateY: -14, x: 40 } : false}
        animate={{ opacity: 1, rotateY: 0, x: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={deluxe ? { transformPerspective: 1400 } : undefined}
        className={deluxe ? deepPanel : panel}
      >
        {deluxe ? (
          <div className="flex items-center gap-3">
            <span className="tq-orb grid size-12 shrink-0 place-items-center rounded-full text-2xl" aria-hidden>
              {card.icon ?? idx + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-action dark:text-dq-300">
                การ์ด {idx + 1}/{cards.length}
              </p>
              <h3 className="text-lg leading-tight text-dq-900 sm:text-xl dark:text-white">{card.title}</h3>
            </div>
          </div>
        ) : (
          <h3 className="text-lg text-dq-900 dark:text-white">
            การ์ด {idx + 1}: {card.title}
          </h3>
        )}
        {deluxe && card.goal && (
          <p className="flex items-start gap-2 rounded-2xl bg-xp-300/35 px-4 py-2.5 dark:bg-xp-500/15">
            <Target className="mt-0.5 size-5 shrink-0 text-xp-600 dark:text-xp-300" aria-hidden />
            <span>
              <span className="font-display text-xp-600 dark:text-xp-300">ภารกิจการ์ดนี้: </span>
              {card.goal}
            </span>
          </p>
        )}
        {card.blocks.map((b, j) => (
          <BlockView key={j} block={b} />
        ))}
        <div
          className={
            deluxe
              ? 'rounded-2xl bg-gradient-to-b from-xp-300/30 to-transparent p-4 ring-2 ring-xp-300 dark:from-xp-500/15 dark:ring-xp-600'
              : 'border-t border-dq-100 pt-4 dark:border-dq-800'
          }
        >
          <p className="mb-2 font-display text-xp-600 dark:text-xp-400">{deluxe ? '✅ เช็กความเข้าใจ (ตอบถูกแล้วไปการ์ดถัดไป)' : 'เช็กความเข้าใจ'}</p>
          <QuestionCard question={card.check} solved={solved.has(card.check.id)} onChecked={onCardChecked} />
        </div>
      </motion.article>
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
  const deluxe = useContext(Deluxe).on
  const levels = deluxe && content.practiceLevels?.length === content.practice.length ? content.practiceLevels : undefined
  const right = content.practice.filter((q) => solved.has(q.id)).length
  const bonus = deluxe ? (content.practiceBonus ?? []) : []
  if (!levels) {
    return (
      <section className="space-y-4">
        <StepHeader step="practice">ทำทีละข้อ ตอบแล้วรู้ผลทันที ข้อที่ผิดกดเลขข้อกลับมาแก้ได้</StepHeader>
        <QuizRunner questions={content.practice} solved={solved} attempted={attempted} onChecked={onChecked} />
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
  return <LevelPractice levels={levels} bonus={bonus} content={content} busy={busy} done={done} finish={finish} onChecked={onChecked} solved={solved} attempted={attempted} right={right} allTried={allTried} />
}

type PracticeStage = { kind: 'intro' } | { kind: 'levels' } | { kind: 'result' } | { kind: 'bonus'; n: number }

// ฝึกปฏิบัติแบบด่าน: ทีละหน้าจอ — แนะนำภารกิจ → ทำด่านทีละด่าน → ผลภารกิจ → เกมซ้อมทีละเกม (ไม่บังคับ)
function LevelPractice({
  levels,
  bonus,
  content,
  busy,
  done,
  finish,
  onChecked,
  solved,
  attempted,
  right,
  allTried,
}: Pick<StepProps, 'content' | 'busy' | 'done' | 'finish' | 'onChecked' | 'solved' | 'attempted'> & {
  levels: NonNullable<SessionContent['practiceLevels']>
  bonus: NonNullable<SessionContent['practiceBonus']>
  right: number
  allTried: boolean
}) {
  const total = levels.length
  const [stage, setStage] = useState<PracticeStage>(() =>
    done || allTried ? { kind: 'result' } : content.practice.some((q) => attempted.has(q.id)) ? { kind: 'levels' } : { kind: 'intro' },
  )
  const go = (s: PracticeStage) => {
    setStage(s)
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const stars = levels.map((_, k) => (k < right ? '⭐' : '☆')).join('')
  const nextBtn = (
    <button type="button" className={primaryBtn} disabled={busy} onClick={() => (done ? undefined : void finish('practice'))}>
      ฝึกครบแล้ว ไปขั้นถัดไป
    </button>
  )

  return (
    <section className="space-y-5">
      <StepHeader step="practice">
        {stage.kind === 'intro' && 'อ่านภารกิจ แล้วกดเริ่มด่าน 1'}
        {stage.kind === 'levels' && 'ทำทีละด่าน ตอบแล้วจะไปด่านถัดไปเอง'}
        {stage.kind === 'result' && 'ดูผลภารกิจ ด่านไหนยังไม่ถูกกลับไปแก้ได้'}
        {stage.kind === 'bonus' && `เกมซ้อม ${stage.n + 1}/${bonus.length} · ไม่คิดคะแนน`}
      </StepHeader>

      <motion.div
        key={stage.kind === 'bonus' ? `bonus-${stage.n}` : stage.kind}
        initial={{ opacity: 0, rotateY: -10, x: 32 }}
        animate={{ opacity: 1, rotateY: 0, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1300 }}
        className="space-y-5"
      >
        {stage.kind === 'intro' && (
          <>
            <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-db-600 to-action-strong p-5 pr-28 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_14px_28px_-14px_rgb(22_63_166/0.8)] sm:p-6 sm:pr-36">
              <NongData mood="think" className="pointer-events-none absolute -right-3 -bottom-3 size-28 drop-shadow-lg sm:size-32" />
              <p className="text-sm font-semibold text-db-100">ภารกิจฝึกฝน</p>
              <p className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">ช่วยน้องดาต้าจัดระเบียบฐานข้อมูล</p>
              <p className="mt-2 text-db-100">มี {total} ด่าน ทำทีละด่าน ตอบถูกได้ด่านละ 1 ดาว</p>
            </div>
            <ol className="space-y-2">
              {levels.map((lv, k) => (
                <li key={lv.title} className="tq-raised flex items-center gap-3 p-3">
                  <span className="tq-orb grid size-11 shrink-0 place-items-center rounded-full text-2xl" aria-hidden>
                    {lv.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-action dark:text-dq-300">ด่าน {k + 1}</span>
                    <span className="font-display">{lv.title}</span>
                  </span>
                </li>
              ))}
            </ol>
            <button type="button" className={primaryBtn} onClick={() => go({ kind: 'levels' })}>
              ▶ เริ่มด่าน 1
            </button>
          </>
        )}

        {stage.kind === 'levels' && (
          <>
            <QuizRunner questions={content.practice} solved={solved} attempted={attempted} onChecked={onChecked} levels={levels} />
            {allTried && (
              <div className="tq-raised flex flex-wrap items-center gap-3 p-4">
                <p className="min-w-0 flex-1 font-display">ทำครบ {total} ด่านแล้ว</p>
                <button type="button" className={primaryBtn} onClick={() => go({ kind: 'result' })}>
                  ดูผลภารกิจ →
                </button>
              </div>
            )}
          </>
        )}

        {stage.kind === 'result' && (
          <div className="tq-raised space-y-4 p-5 text-center sm:p-6">
            <NongData mood={right === total ? 'cheer' : 'think'} className="mx-auto size-28" />
            <p className="text-4xl tracking-wider" aria-label={`ได้ ${right} จาก ${total} ดาว`}>
              {stars}
            </p>
            <p className="font-display text-xl text-dq-900 dark:text-white">
              {right === total ? 'ผ่านครบทุกด่าน เก่งมาก!' : `ผ่าน ${right} จาก ${total} ด่าน`}
            </p>
            {right < total && (
              <button type="button" className={navBtn} onClick={() => go({ kind: 'levels' })}>
                ← กลับไปแก้ด่านที่ยังไม่ถูก
              </button>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {bonus.length > 0 && (
                <button type="button" className={navBtn} onClick={() => go({ kind: 'bonus', n: 0 })}>
                  ⚡ ซ้อมเพิ่ม (ไม่บังคับ)
                </button>
              )}
              {done ? <DoneNote /> : nextBtn}
            </div>
          </div>
        )}

        {stage.kind === 'bonus' && bonus[stage.n] && (
          <>
            <BlockView block={bonus[stage.n]!} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" className={navBtn} onClick={() => go({ kind: 'result' })}>
                ← กลับไปผลภารกิจ
              </button>
              {stage.n + 1 < bonus.length ? (
                <button type="button" className={navBtn} onClick={() => go({ kind: 'bonus', n: stage.n + 1 })}>
                  เกมซ้อมถัดไป →
                </button>
              ) : done ? (
                <DoneNote />
              ) : (
                nextBtn
              )}
            </div>
          </>
        )}
      </motion.div>
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
}: StepProps & { markDone: (step: StepKey) => void; goNext: (step: StepKey) => void; nextTitle?: string }) {
  const game = content.game
  const deluxe = useContext(Deluxe).on
  if (!game) return null
  return (
    <section className="space-y-4">
      <StepHeader step="game">{game.description}</StepHeader>
      {deluxe && (
        <ol className="grid gap-2 sm:grid-cols-3">
          {[
            ['🃏', 'เปิดไพ่ทีละ 2 ใบ'],
            ['🔗', 'จับคู่ศัพท์กับความหมายที่ใช่'],
            ['⭐', 'เปิดผิดน้อย จบเร็ว ได้ดาวมาก'],
          ].map(([icon, t], i) => (
            <li key={t} className="tq-raised flex items-center gap-3 p-3">
              <span className="tq-orb grid size-10 shrink-0 place-items-center rounded-full text-xl" aria-hidden>
                {icon}
              </span>
              <span className="text-base leading-snug">
                <span className="font-display text-action dark:text-dq-300">{i + 1}. </span>
                {t}
              </span>
            </li>
          ))}
        </ol>
      )}
      {done && <DoneNote>เล่นเกมแล้ว เล่นซ้ำเพื่อเก็บดาวเพิ่มได้</DoneNote>}
      <div className={deluxe ? 'rounded-[2rem] p-1.5 shadow-[0_4px_0_var(--color-dq-300),0_26px_40px_-24px_rgb(15_31_61/0.7)] ring-1 ring-dq-200 dark:shadow-[0_4px_0_#0b1630,0_26px_40px_-24px_rgb(0_0_0/0.9)] dark:ring-dq-800' : ''}>
      <GameView
        gameKey={game.slug}
        embedded={{
          onStepDone: () => markDone('game'),
          nextLabel: nextTitle ? `เล่นจบแล้ว ไปขั้น${nextTitle}` : 'เล่นจบแล้ว',
          // โหมดครูไม่บันทึกขั้นเกมตอนเล่นจบ จึงให้ปุ่มนี้บันทึกแทน
          onNext: () => (done ? goNext('game') : void finish('game')),
        }}
      />
      </div>
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
  const P = usePanel()
  const deluxe = useContext(Deluxe).on
  const ws = content.worksheet
  const tableCfg = ws?.table
  const [text, setText] = useState(initialSubmission?.content.text ?? '')
  const [sheet, setSheet] = useState(() => (tableCfg ? loadSheet(initialSubmission?.content.text, tableCfg) : null))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!ws) return null
  const graded = initialSubmission?.graded_at != null
  const missing = sheet && tableCfg ? missingParts(sheet, tableCfg) : []
  const canSubmit = sheet ? missing.length === 0 : text.trim().length > 0
  const wizard = deluxe && !!sheet && !!tableCfg

  const onSubmit = async () => {
    setSending(true)
    setError(null)
    try {
      // ครูดูตัวอย่าง: ไม่ส่งจริง (เซิร์ฟเวอร์รับใบงานจากนักเรียนเท่านั้น)
      if (!preview) await submitWorksheet(ws.item_id, sheet ? serializeSheet(sheet) : text)
      await finish('worksheet')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  const submitBox = (
    <div className="space-y-3">
      {error && <p className="text-rose-600 dark:text-rose-300">{error}</p>}
      {done && <DoneNote>ส่งใบงานแล้ว แก้แล้วส่งใหม่ได้จนกว่าครูจะตรวจ</DoneNote>}
      {!graded && (
        <button type="button" className={primaryBtn} disabled={busy || sending || !canSubmit} onClick={() => void onSubmit()}>
          {sending ? 'กำลังส่ง…' : done ? 'ส่งฉบับแก้ไข' : 'ส่งใบงาน'}
        </button>
      )}
    </div>
  )
  const gradedBox =
    graded && initialSubmission ? (
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
    ) : null

  if (wizard) {
    return (
      <section className="space-y-5">
        <StepHeader step="worksheet">ทำทีละหน้า กรอกครบแล้วกด “ถัดไป” หน้าสุดท้ายตรวจทานแล้วส่ง</StepHeader>
        <div className="tq-banner flex items-center gap-3 rounded-2xl px-4 py-3 text-white">
          <span className="tq-orb grid size-11 shrink-0 place-items-center rounded-full text-2xl" aria-hidden>
            📝
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight">{ws.title}</p>
            <p className="text-sm text-db-100">เต็ม {ws.max_score} คะแนน · ใช้ทุกเรื่องที่เรียนวันนี้</p>
          </div>
        </div>
        <details className="tq-raised p-4">
          <summary className="cursor-pointer font-display text-dq-700 dark:text-dq-200">ดูคำสั่งทั้งหมด</summary>
          <div className="mt-2 whitespace-pre-line">{ws.instructions}</div>
        </details>
        {gradedBox}
        <WorksheetWizard sheet={sheet} cfg={tableCfg} disabled={graded} onChange={setSheet} submit={submitBox} />
      </section>
    )
  }

  return (
    <section className={P}>
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
      {sheet && tableCfg ? (
        <TableWorksheetEditor sheet={sheet} cfg={tableCfg} disabled={graded} onChange={setSheet} />
      ) : (
        <textarea
          className={`${textArea} min-h-48`}
          aria-label="คำตอบใบงาน"
          maxLength={10000}
          disabled={graded}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {!graded && missing.length > 0 && (
        <p className="text-slate-600 dark:text-dq-300">ยังขาด: {missing.join(' · ')}</p>
      )}
      {error && <p className="text-rose-600 dark:text-rose-300">{error}</p>}
      {done && <DoneNote>ส่งใบงานแล้ว แก้แล้วส่งใหม่ได้จนกว่าครูจะตรวจ</DoneNote>}
      {!graded && (
        <button type="button" className={primaryBtn} disabled={busy || sending || !canSubmit} onClick={() => void onSubmit()}>
          {sending ? 'กำลังส่ง…' : done ? 'ส่งฉบับแก้ไข' : 'ส่งใบงาน'}
        </button>
      )}
    </section>
  )
}

function WrapupStep(props: StepProps & { guess: string }) {
  const deluxe = useContext(Deluxe).on
  const c = props.content
  if (deluxe && c.closing && c.recap && c.intro?.guide?.length) return <DeluxeWrapup {...props} />
  return <PlainWrapup {...props} />
}

type WrapStage = 'recap' | 'mission' | 'reflect'
const WRAP_STAGES: { id: WrapStage; icon: string; title: string }[] = [
  { id: 'recap', icon: '📚', title: 'สรุปบทเรียน' },
  { id: 'mission', icon: '🎯', title: 'ภารกิจปิดคาบ' },
  { id: 'reflect', icon: '🪞', title: 'ก่อน–หลังเรียน' },
]

// ปิดคาบแบบใหม่ ทีละหน้า: สรุปเป็นผังภาพ → ภารกิจทีละด่าน → เทียบคำตอบก่อน/หลังเรียน + เช็กเป้าหมาย → จบคาบ
function DeluxeWrapup({ content, busy, done, finish, onChecked, solved, attempted, guess }: StepProps & { guess: string }) {
  const closing = content.closing!
  const recap = content.recap!
  const intro = content.intro!
  const slots = intro.guide ?? [FREE_SLOT]
  const total = closing.questions.length
  const tried = closing.questions.filter((q) => attempted.has(q.id)).length
  const right = closing.questions.filter((q) => solved.has(q.id)).length
  const allTried = tried === total
  const [stage, setStage] = useState<WrapStage>(() => (done ? 'reflect' : tried > 0 ? 'mission' : 'recap'))
  const [after, setAfter] = useState(() => slots.map(() => ''))
  const [goals, setGoals] = useState<ReadonlySet<number>>(() => new Set())
  const afterDone = after.every((v) => v.trim())
  const go = (s: WrapStage) => {
    setStage(s)
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const at = WRAP_STAGES.findIndex((s) => s.id === stage)

  return (
    <section className="space-y-5">
      <StepHeader step="wrapup">ทำทีละหน้า: สรุป → ภารกิจ → เทียบก่อน-หลังเรียน</StepHeader>
      <nav aria-label="หน้าของการปิดคาบ" className="tq-raised flex justify-center p-3">
        <ol className="flex items-start">
          {WRAP_STAGES.map((s, i) => {
            const on = i === at
            const passed = i < at || (i === 2 && done)
            const can = i <= at || done || (i === 1) || (i === 2 && allTried)
            return (
              <li key={s.id} className="flex items-start">
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => go(s.id)}
                  aria-current={on ? 'step' : undefined}
                  className="flex w-24 flex-col items-center gap-1 text-center disabled:opacity-45 sm:w-28"
                >
                  <span
                    className={`grid size-12 place-items-center rounded-full text-2xl transition ${
                      on
                        ? 'tq-orb tq-glow scale-110'
                        : passed
                          ? 'bg-radial-[at_32%_28%] from-mint-400 to-mint-500 shadow-[inset_0_3px_6px_rgb(255_255_255/0.45)]'
                          : 'bg-white ring-2 ring-dq-200 dark:bg-dq-900 dark:ring-dq-700'
                    }`}
                    aria-hidden
                  >
                    {s.icon}
                  </span>
                  <span className={`text-sm leading-tight ${on ? 'font-semibold text-action dark:text-dq-200' : 'text-ink-2 dark:text-dq-300'}`}>
                    {i + 1}. {s.title}
                  </span>
                </button>
                {i < WRAP_STAGES.length - 1 && (
                  <span aria-hidden className={`mt-6 ${passed ? 'text-mint-500' : 'text-dq-300 dark:text-dq-600'}`}>
                    <span className="tq-flow-line block h-1 w-6 rounded-full sm:w-12" />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <motion.div
        key={stage}
        initial={{ opacity: 0, rotateY: -10, x: 32 }}
        animate={{ opacity: 1, rotateY: 0, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformPerspective: 1300 }}
        className="space-y-5"
      >
        {stage === 'recap' && (
          <>
            <div className="tq-raised space-y-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="tq-orb grid size-12 shrink-0 place-items-center rounded-full text-2xl" aria-hidden>
                  📚
                </span>
                <div>
                  <h3 className="text-xl leading-tight text-dq-900 dark:text-white">วันนี้เราเรียนอะไรไปบ้าง</h3>
                  <p className="text-base text-slate-600 dark:text-dq-300">แตะทีละคำ ดูว่าคำนั้นคือส่วนไหนของตาราง</p>
                </div>
              </div>
              <RecapBoard items={recap.items} withTable={recap.widget === 'recap-table'} />
            </div>
            <div className="tq-raised space-y-3 p-5 sm:p-6">
              <p className="font-display text-lg text-dq-900 dark:text-white">⭐ 3 ข้อที่ต้องจำ</p>
              <ol className="grid gap-3 md:grid-cols-3">
                {content.summary.map((s, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.12 }}
                    className="flex gap-3 rounded-2xl bg-gradient-to-b from-dq-50 to-white p-3 ring-1 ring-dq-100 dark:from-dq-900 dark:to-dq-950 dark:ring-dq-800"
                  >
                    <span className="tq-orb grid size-9 shrink-0 place-items-center rounded-full font-display" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{s}</span>
                  </motion.li>
                ))}
              </ol>
            </div>
            <div className="flex justify-end">
              <button type="button" className={primaryBtn} onClick={() => go('mission')}>
                เข้าใจแล้ว ไปภารกิจปิดคาบ →
              </button>
            </div>
          </>
        )}

        {stage === 'mission' && (
          <>
            <div className="tq-raised space-y-4 p-5 sm:p-6">
              <h3 className="flex items-center gap-3 text-lg text-ink dark:text-white">
                <span className="tq-orb grid size-11 shrink-0 place-items-center rounded-full text-xl" aria-hidden>
                  🎯
                </span>
                {closing.title}
              </h3>
              {closing.blocks.map((b, i) => (
                <BlockView key={i} block={b} />
              ))}
            </div>
            <QuizRunner
              questions={closing.questions}
              solved={solved}
              attempted={attempted}
              onChecked={onChecked}
              levels={closing.levels?.length === total ? closing.levels : undefined}
            />
            {allTried && (
              <div className="tq-raised flex flex-wrap items-center gap-3 p-4">
                <p className="min-w-0 flex-1">
                  ตอบครบแล้ว · ถูก <span className="font-semibold tabular-nums text-mint-500">{right}</span>/{total} ข้อ
                  {right < total && <span className="block text-base text-ink-2 dark:text-dq-300">ข้อที่ยังไม่ถูก แตะด่านนั้นแล้วตอบใหม่ได้</span>}
                </p>
                <button type="button" className={primaryBtn} onClick={() => go('reflect')}>
                  ไปเทียบก่อน–หลังเรียน →
                </button>
              </div>
            )}
          </>
        )}

        {stage === 'reflect' && (
          <>
            <div className="tq-banner rounded-2xl px-4 py-4 text-white sm:px-5">
              <p className="text-sm text-db-100">คำถามก่อนเรียน (ถามอีกครั้ง)</p>
              <p className="mt-1 text-lg font-semibold leading-snug sm:text-xl">{intro.bigQuestion}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="tq-raised space-y-2 p-4">
                <p className="font-display text-slate-600 dark:text-dq-300">🕰️ ก่อนเรียน ฉันตอบว่า</p>
                <p className="whitespace-pre-wrap rounded-2xl bg-dq-50 p-3 leading-relaxed dark:bg-dq-950">{guess.trim() || '(ไม่ได้บันทึกไว้)'}</p>
              </div>
              <GuideBox
                no="✓"
                question="หลังเรียน ตอนนี้ฉันตอบว่า"
                slots={slots.map((s) => ({ ...s, hint: 'ใช้คำที่เรียนวันนี้ เช่น ระเบียน คีย์หลัก สืบค้น' }))}
                values={after}
                required
                onChange={(j, v) => setAfter((a) => a.map((x, k) => (k === j ? v : x)))}
              />
            </div>
            {intro.recap && (
              <AnimatePresence>
                {afterDone ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-emerald-50 p-4 ring-2 ring-mint-400 dark:bg-emerald-950/40"
                  >
                    <p className="font-display text-emerald-900 dark:text-emerald-100">💬 คำอธิบายจากบทเรียน ลองเทียบกับคำตอบของเรา</p>
                    <DbqMarkdown text={intro.recap} />
                  </motion.div>
                ) : (
                  <p className="rounded-2xl bg-dq-50 px-4 py-3 text-slate-600 dark:bg-dq-950 dark:text-dq-300">✍️ เขียนคำตอบหลังเรียนให้ครบก่อน แล้วคำอธิบายจากบทเรียนจะขึ้นมาให้เทียบ</p>
                )}
              </AnimatePresence>
            )}
            {intro.goals && (
              <div className="tq-raised space-y-2 p-4 sm:p-5">
                <p className="font-display text-lg text-dq-900 dark:text-white">🎯 เป้าหมายคาบนี้ ฉันทำได้แล้วหรือยัง</p>
                <p className="text-base text-slate-600 dark:text-dq-300">แตะข้อที่มั่นใจว่าทำได้ ข้อที่ยังไม่มั่นใจ กลับไปดูบทเรียนได้</p>
                <ul className="space-y-2">
                  {intro.goals.map((g, i) => {
                    const on = goals.has(i)
                    return (
                      <li key={g}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => setGoals((s) => {
                            const n = new Set(s)
                            if (n.has(i)) n.delete(i)
                            else n.add(i)
                            return n
                          })}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                            on ? 'bg-emerald-50 ring-2 ring-mint-400 dark:bg-emerald-950/40' : 'bg-white ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:ring-dq-700'
                          }`}
                        >
                          <span className={`grid size-8 shrink-0 place-items-center rounded-full font-display ${on ? 'bg-mint-500 text-white' : 'bg-dq-100 text-dq-700 dark:bg-dq-800 dark:text-dq-200'}`}>
                            {on ? '✓' : i + 1}
                          </span>
                          <span className="leading-snug">{g}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <div className="tq-raised flex flex-wrap items-center gap-3 p-4">
              <p className="min-w-0 flex-1">
                ภารกิจถูก <span className="font-semibold tabular-nums">{right}/{total}</span> ข้อ
                {!allTried && <span className="block text-base text-ink-2 dark:text-dq-300">ยังทำภารกิจปิดคาบไม่ครบ กลับไปหน้า 2 ก่อนนะ</span>}
              </p>
              {done ? (
                <DoneNote />
              ) : (
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={busy || !allTried || !afterDone}
                  onClick={() => void finish('wrapup', { after: composeGuide(slots, after), goals: [...goals] })}
                >
                  {!afterDone ? 'เขียนคำตอบหลังเรียนก่อน' : 'จบคาบ 🎉'}
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </section>
  )
}

function PlainWrapup({ content, busy, done, finish, onChecked, solved, attempted }: StepProps) {
  const P = usePanel()
  const closing = content.closing
  const [reflection, setReflection] = useState('')

  if (!closing) {
    // คาบที่ยังไม่มีภารกิจปิดคาบ: สรุป + เขียนสิ่งที่ได้เรียนรู้
    return (
      <section className={P}>
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
      <div className={P}>
        <h3 className="flex items-center gap-2 text-lg text-ink dark:text-white">
          <Flag className="size-5 text-action" aria-hidden /> {closing.title}
        </h3>
        {closing.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
      <QuizRunner questions={closing.questions} solved={solved} attempted={attempted} onChecked={onChecked} />
      <div className={`${P} flex flex-wrap items-center gap-3`}>
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
