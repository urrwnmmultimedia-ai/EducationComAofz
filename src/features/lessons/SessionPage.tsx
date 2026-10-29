import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { BookOpen, Flame, Gamepad2, PencilLine, Sparkles, Star, Target, Ticket, type LucideIcon } from 'lucide-react'
import { StepJourney } from '@/components/StepJourney'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { NamWan, Non } from '@/components/characters/Characters'
import { EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import type { AssignmentRow, ExamRow } from '@/lib/database.types'
import { dueCountdown } from '@/features/student/studentApi'
import { GameView } from '@/features/games/GamePlayPage'
import { AssignmentView } from '@/features/assignments/AssignmentPage'
import { ExamView } from '@/features/exams/ExamPage'
import { LessonCards } from './LessonCards'
import { Markdown } from './Markdown'
import { GAME_PASS_SCORE, type SessionStep, type StepKey } from './sessionSteps'
import { useSessionPage } from './useSessionPage'

const STEP_ICON: Record<StepKey, LucideIcon> = {
  warmup: Flame,
  content: BookOpen,
  game: Gamepad2,
  work: PencilLine,
  exit: Ticket,
  summary: Star,
}

export function SessionPage() {
  const params = useParams()
  const sessionNo = Number(params.no)
  const { identity } = useAuth()
  const isStudent = identity.role === 'student'
  const { detail, steps, completed, setCompleted, savingStep, saveError, completeStep, work, markSent } = useSessionPage(
    sessionNo,
    isStudent,
    identity.student?.id ?? null,
  )
  const [search] = useSearchParams()
  const location = useLocation()
  // ?step=work เปิดขั้นนั้น · ?after=game เปิดขั้นถัดจากเกม (กลับมาจากเกม/งาน/ข้อสอบ)
  // ขั้นที่กดเลือกเองใช้ได้เฉพาะ URL เดิม — กลับมาด้วยลิงก์ ?after= ใหม่ ให้ URL เป็นตัวกำหนด
  const [pickedAt, setPickedAt] = useState<{ loc: string; step: StepKey } | null>(null)
  const picked = pickedAt?.loc === location.key ? pickedAt.step : null
  const [guess, setGuess] = useGuess(sessionNo)
  // เล่นเกมผ่านในหน้าคาบ: รอให้เห็นผลสักครู่แล้วไปขั้นถัดไปเอง
  const [gamePassed, setGamePassed] = useState(false)

  if (!Number.isInteger(sessionNo) || sessionNo < 1) return <ErrorBlock message="ไม่พบคาบเรียนนี้" />
  if (detail.status === 'loading') return <LoadingBlock label="กำลังเปิดคาบเรียน…" />
  if (detail.status === 'error') return <ErrorBlock message={detail.error} onRetry={detail.reload} />
  if (!detail.data) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center ring-1 ring-brand-100">
        <span className="text-5xl" aria-hidden>
          🔒
        </span>
        <h1 className="text-xl text-brand-900">คาบที่ {sessionNo} ยังไม่เปิด</h1>
        <p className="text-slate-600">รอครูปลดล็อกคาบนี้ในชั่วโมงเรียนนะ</p>
        <Link to="/home" className="font-display text-brand-700 underline">
          กลับหน้าหลัก
        </Link>
      </div>
    )
  }

  const { session, lessons, assignments, exams, unit } = detail.data
  const after = search.get('after')
  const afterIdx = after ? steps.findIndex((s) => s.key === after) : -1
  const wanted = picked ?? (search.get('step') as StepKey | null) ?? (afterIdx >= 0 ? steps[Math.min(afterIdx + 1, steps.length - 1)]?.key : undefined)
  const firstOpen = steps.find((s) => !completed.includes(s.key))?.key
  // นักเรียนต้องผ่านทีละขั้น: ไปได้ถึงขั้นแรกที่ยังไม่ผ่านเท่านั้น (ครูดูตัวอย่างได้ทุกขั้น)
  const openIdx = firstOpen ? steps.findIndex((s) => s.key === firstOpen) : steps.length - 1
  const reachable = (key: string) => !isStudent || steps.findIndex((s) => s.key === key) <= openIdx
  const locked = new Set(steps.filter((s) => !reachable(s.key)).map((s) => s.key))
  const target = wanted && reachable(wanted) ? wanted : firstOpen
  const current = steps.find((s) => s.key === target) ?? steps[0]
  const doneCount = steps.filter((s) => completed.includes(s.key)).length
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0
  const currentIdx = current ? steps.indexOf(current) : -1
  const next = steps[currentIdx + 1]
  const currentDone = !!current && completed.includes(current.key)
  const examsInWork = !steps.some((x) => x.key === 'exit')
  const examsSent = !!work && exams.every((e) => work.examsDone.includes(e.id))
  const needsAnswer = !!(current?.question || current?.items?.length)
  // ขั้นที่ทำครบแล้วผ่านเอง ไม่มีปุ่มไปขั้นถัดไป: ส่งงาน/ข้อสอบครบ หรือขั้นที่ไม่มีอะไรให้ทำ
  // (ตอบคำถามเปิดคาบ อ่านการ์ดครบ และจบคาบ มีปุ่มของขั้นนั้นเอง · เกมผ่านเมื่อได้คะแนนถึงเกณฑ์)
  const autoReady: Record<StepKey, boolean> = {
    warmup: !needsAnswer,
    content: lessons.length === 0,
    game: !session.game_slug,
    work: !!work && assignments.every((a) => a.type === 'score_only' || work.submitted.includes(a.id)) && (!examsInWork || examsSent),
    exit: examsSent,
    summary: false,
  }
  const autoFinish = !!current && isStudent && !currentDone && autoReady[current.key]
  const hint: Partial<Record<StepKey, string>> = {
    game: `เล่นเกมให้ได้อย่างน้อย ${GAME_PASS_SCORE} คะแนน จะไปขั้นถัดไปให้เอง`,
    work: work ? 'ส่งงานในขั้นนี้ให้ครบ จะไปขั้นถัดไปให้เอง' : 'กำลังตรวจสถานะการส่งงาน…',
    exit: work ? 'ทำ Exit ticket และส่งให้ครบ จะไปขั้นถัดไปให้เอง' : 'กำลังตรวจสถานะการส่ง…',
  }
  const currentHint = current && isStudent && !currentDone && !autoFinish ? hint[current.key] : undefined

  const setActive = (step: StepKey) => {
    if (!reachable(step)) return
    setPickedAt({ loc: location.key, step })
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  // ทำขั้นนี้เสร็จ (นักเรียนบันทึกผล ครูแค่เลื่อนไปขั้นถัดไป)
  const finishCurrent = async () => {
    if (!current) return
    if (isStudent && !currentDone) await completeStep(current.key)
    if (next) setPickedAt({ loc: location.key, step: next.key })
    scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/lessons" className="hover:text-brand-700">
          บทเรียน
        </Link>
        {unit && (
          <>
            {' / '}
            <Link to={`/units/${unit.no}`} className="hover:text-brand-700">
              หน่วยที่ {unit.no}
            </Link>
          </>
        )}
        {' / '}คาบที่ {session.session_no}
      </nav>

      <header className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-lg sm:p-6">
        <p className="text-sm text-brand-100">
          คาบที่ {session.session_no}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl">{session.title}</h1>
        {session.summary && <p className="mt-2 text-brand-100">{session.summary}</p>}
        {isStudent && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <ProgressBar value={percent} className="w-40 bg-white/20" />
            <span>
              ทำแล้ว {doneCount}/{steps.length} ขั้น
            </span>
          </div>
        )}
      </header>

      <StepJourney
        label="ขั้นตอนในคาบ"
        steps={steps.map((s) => ({ key: s.key, label: s.label, icon: STEP_ICON[s.key] }))}
        current={current?.key ?? ''}
        done={new Set(completed)}
        locked={locked}
        onSelect={(k) => setActive(k as StepKey)}
      />

      {!isStudent && (
        <p className="rounded-2xl bg-sun-300/40 px-4 py-2 text-sm text-amber-900">
          โหมดครู: ครูดูได้ทุกขั้นและไม่บันทึกผล · นักเรียนต้องทำทีละขั้น ตอบคำถาม ส่งงาน หรือเล่นเกมให้ได้อย่างน้อย {GAME_PASS_SCORE} คะแนนก่อน จึงไปขั้นถัดไปได้
        </p>
      )}

      {current && (
        <section aria-live="polite">
          <StepBody
            key={current.key}
            step={current}
            steps={steps}
            lessons={lessons}
            assignments={assignments}
            exams={exams}
            examsInWork={examsInWork}
            workLabel={session.work_label}
            gameSlug={session.game_slug}
            sessionNo={session.session_no}
            isStudent={isStudent}
            lessonsLocked={isStudent && !currentDone}
            guess={guess}
            onGuess={setGuess}
            onLessonDone={() => void finishCurrent()}
            onGameStepDone={(c) => {
              setCompleted(c)
              setGamePassed(true)
            }}
            stepDone={currentDone}
            saving={savingStep === current.key}
            onFinish={() => void finishCurrent()}
            sent={work}
            onSent={markSent}
          />
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm">
            {saveError && (
              <span className="text-rose-600">
                {saveError}{' '}
                <button type="button" className="underline" onClick={() => void finishCurrent()}>
                  ลองอีกครั้ง
                </button>
              </span>
            )}
            {currentHint && <span className="text-amber-700">🔒 {currentHint}</span>}
            {isStudent && currentDone && current.key !== 'summary' && next && !gamePassed && (
              <span className="font-display text-mint-500">ทำขั้นนี้แล้ว ✓</span>
            )}
          </div>
          {autoFinish && next && <AutoAdvance key={`auto-${current.key}`} label={next.label} onFire={() => void finishCurrent()} />}
          {autoFinish && !next && <AutoAdvance key={`auto-${current.key}`} label="" onFire={() => void finishCurrent()} />}
          {gamePassed && current.key === 'game' && next && (
            <AutoAdvance
              key="game-passed"
              label={next.label}
              onFire={() => {
                setGamePassed(false)
                setActive(next.key)
              }}
            />
          )}
        </section>
      )}
    </div>
  )
}

// คำตอบ "ก่อนเรียน" ของขั้นเปิดคาบ เก็บในเบราว์เซอร์ ใช้ย้อนดูตอนสรุปท้ายคาบ
function useGuess(sessionNo: number): [string, (g: string) => void] {
  const storageKey = `tq-guess-${sessionNo}`
  const [guess, setGuessState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? ''
    } catch {
      return ''
    }
  })
  const setGuess = (g: string) => {
    setGuessState(g)
    try {
      localStorage.setItem(storageKey, g)
    } catch {
      // เบราว์เซอร์ไม่ให้เก็บ: ใช้ได้เฉพาะรอบนี้
    }
  }
  return [guess, setGuess]
}

interface StepBodyProps {
  step: SessionStep
  steps: SessionStep[]
  lessons: { id: string; title: string; content_md: string }[]
  assignments: AssignmentRow[]
  exams: ExamRow[]
  examsInWork: boolean // คาบที่ไม่มีขั้น Exit ticket (เช่น คาบสอบ) แสดงชุดสอบในขั้นงาน
  workLabel: string
  gameSlug: string | null
  sessionNo: number
  isStudent: boolean
  lessonsLocked: boolean // นักเรียนต้องตอบเช็กความเข้าใจถูกก่อนไปการ์ดถัดไป
  guess: string
  onGuess: (g: string) => void
  onLessonDone: () => void
  onGameStepDone: (completed: string[]) => void
  stepDone: boolean
  saving: boolean
  onFinish: () => void // ปุ่มของขั้น (ส่งคำตอบเปิดคาบ / จบคาบ) บันทึกแล้วไปขั้นถัดไป
  sent: { submitted: string[]; examsDone: string[] } | null // งาน/ข้อสอบที่ส่งแล้ว
  onSent: (kind: 'assignment' | 'exam', id: string) => void
}

function StepBody({
  step,
  steps,
  lessons,
  assignments,
  exams,
  examsInWork,
  workLabel,
  gameSlug,
  sessionNo,
  isStudent,
  lessonsLocked,
  guess,
  onGuess,
  onLessonDone,
  onGameStepDone,
  stepDone,
  saving,
  onFinish,
  sent,
  onSent,
}: StepBodyProps) {
  const answerButton = (
    <Button className="mt-4" loading={saving} disabled={!guess.trim()} onClick={onFinish}>
      {stepDone ? 'บันทึกคำตอบ ไปขั้นถัดไป →' : 'ตอบคำถาม ไปขั้นถัดไป →'}
    </Button>
  )
  switch (step.key) {
    case 'warmup':
      if (step.question) return <OpeningStep step={step} guess={guess} onGuess={onGuess} action={answerButton} />
      return (
        <Panel character={<NamWan className="size-16" />} title="คำถามชวนคิด">
          {step.items && step.items.length > 0 ? (
            <ol className="list-decimal space-y-2 pl-6 text-lg">
              {step.items.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          ) : (
            <p className="text-slate-500">ครูจะถามคำถามอุ่นเครื่องในห้องเรียน</p>
          )}
          {step.items && step.items.length > 0 ? (
            <>
              <AnswerBox label="คำตอบของฉัน" placeholder="ตอบสั้น ๆ ตามที่คิด ไม่มีถูกผิด" value={guess} onChange={onGuess} />
              {answerButton}
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">คิดคำตอบในใจ หรือคุยกับเพื่อนข้าง ๆ แล้วครูจะสุ่มถาม</p>
          )}
        </Panel>
      )
    case 'content':
      return lessons.length === 0 ? (
        <EmptyBlock>ครูยังไม่ได้ใส่เนื้อหาคาบนี้</EmptyBlock>
      ) : (
        <div className="flex flex-col gap-6">
          {lessons.map((l, i) => (
            <LessonCards
              key={l.id}
              title={l.title}
              markdown={l.content_md}
              locked={lessonsLocked}
              onFinished={i === lessons.length - 1 ? onLessonDone : undefined}
            />
          ))}
        </div>
      )
    case 'game': {
      // คาบแบบ DB Quest (มีคำถามเปิดคาบ) ฝังเกมในหน้าคาบเลย · คาบอื่นเปิดหน้าเกมแยก
      const nextStep = steps[steps.findIndex((s) => s.key === 'game') + 1]
      if (gameSlug && steps.some((s) => s.question)) {
        return (
          <GameView
            slug={gameSlug}
            preview={!isStudent}
            sessionNo={isStudent ? sessionNo : null}
            backTo={`/sessions/${sessionNo}?after=game`}
            backLabel={nextStep ? `ไปขั้น${nextStep.label}` : 'กลับคาบเรียน'}
            onStepDone={onGameStepDone}
          />
        )
      }
      return (
        <Panel character={<Non className="size-16" />} title="เวลาเล่นเกม!">
          {gameSlug ? (
            <>
              <p>เกมประจำคาบนี้พร้อมให้ลองแล้ว เล่นครั้งแรกได้ XP เต็ม</p>
              <Link
                to={`/games/${gameSlug}?session=${sessionNo}`}
                className="mt-4 inline-flex rounded-2xl tq-press bg-action px-5 py-2.5 font-semibold text-white shadow-action hover:bg-brand-600"
              >
                🎮 ไปเล่นเกม
              </Link>
            </>
          ) : (
            <p className="text-slate-500">คาบนี้ไม่มีเกม ใช้เวลาทำกิจกรรมเพิ่ม</p>
          )}
        </Panel>
      )
    }
    case 'work': {
      const items: WorkItem[] = [
        ...(examsInWork ? exams.map((e): WorkItem => ({ kind: 'exam', exam: e })) : []),
        ...assignments.map((a): WorkItem => ({ kind: 'assignment', assignment: a })),
      ]
      return (
        <div className="flex flex-col gap-4">
          {workLabel && <p className="font-display text-lg text-brand-900">{workLabel}</p>}
          {items.length === 0 ? (
            <Panel title="งาน / กิจกรรม">
              <p className="text-slate-500">ครูยังไม่ได้เปิดงานในเว็บสำหรับคาบนี้</p>
            </Panel>
          ) : (
            <WorkPager items={items} isStudent={isStudent} sent={sent} onSent={onSent} />
          )}
        </div>
      )
    }
    case 'exit':
      return (
        <div className="flex flex-col gap-4">
          <p className="font-display text-lg text-brand-900">ตอบคำถามท้ายคาบ ตอบถูกครบรับ +20 XP</p>
          {exams.length === 0 ? (
            <Panel title="Exit ticket และแบบทดสอบ">
              <p className="text-sm text-slate-500">คาบนี้ยังไม่มีแบบทดสอบ</p>
            </Panel>
          ) : (
            <WorkPager items={exams.map((e) => ({ kind: 'exam', exam: e }))} isStudent={isStudent} sent={sent} onSent={onSent} />
          )}
        </div>
      )
    case 'summary':
      return (
        <Panel title="สรุปวันนี้">
          {guess.trim() && (
            <div className="mb-4 rounded-2xl bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-700">ก่อนเรียน เราตอบคำถามเปิดคาบไว้ว่า</p>
              <p className="mt-1 whitespace-pre-line">“{guess}”</p>
              <p className="mt-2 text-sm text-slate-600">เรียนจบแล้ว คำตอบนี้ถูกไหม อยากเติมอะไรเพิ่ม? คุยกับเพื่อนข้าง ๆ หรือเขียนลงสมุด</p>
            </div>
          )}
          {step.items && step.items.length > 0 ? (
            <ul className="space-y-2">
              {step.items.map((s) => (
                <li key={s} className="flex gap-2">
                  <span aria-hidden>⭐</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">ร่วมกันสรุปสิ่งที่ได้เรียนรู้กับครู</p>
          )}
          {isStudent &&
            (stepDone ? (
              <p className="mt-4 font-display text-mint-500">จบคาบแล้ว เก่งมาก! 🎉</p>
            ) : (
              <Button className="mt-4" loading={saving} onClick={onFinish}>
                จบคาบ ✓
              </Button>
            ))}
        </Panel>
      )
  }
}

// ขั้นเปิดคาบแบบ DB Quest: คำถามใหญ่ → ตอบตามที่คิด (ไม่มีถูกผิด) → เรียนไปทำไม → เป้าหมาย → ชวนคิดเพิ่ม
function OpeningStep({ step, guess, onGuess, action }: { step: SessionStep; guess: string; onGuess: (g: string) => void; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-action to-action-strong p-5 pr-24 text-white sm:p-6 sm:pr-32">
        <NamWan className="pointer-events-none absolute -bottom-2 -right-2 size-24 drop-shadow-lg sm:size-28" />
        <p className="text-sm font-semibold text-brand-100">คำถามก่อนเรียน</p>
        <p className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{step.question}</p>
      </div>
      <AnswerBox
        label="คำตอบของฉัน (ก่อนเรียน) — ตอบตามที่คิด ไม่มีถูกผิด"
        placeholder="ตอบสั้น ๆ ตามที่คิด ท้ายคาบจะกลับมาดูกันอีกที"
        value={guess}
        onChange={onGuess}
      />
      <div>{action}</div>
      {(step.why || (step.goals && step.goals.length > 0)) && (
        <div className="grid gap-4 md:grid-cols-2">
          {step.why && (
            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
                <Sparkles className="size-5 text-amber-500" aria-hidden /> เรียนไปทำไม
              </p>
              <Markdown text={step.why} />
            </div>
          )}
          {step.goals && step.goals.length > 0 && (
            <div className="rounded-2xl bg-brand-50 p-4">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-ink">
                <Target className="size-5 text-action" aria-hidden /> จบคาบนี้ เราจะ…
              </p>
              <ol className="space-y-2">
                {step.goals.map((g, i) => (
                  <li key={g} className="flex gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-brand-700">{i + 1}</span>
                    <span className="leading-relaxed">{g}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {step.items && step.items.length > 0 && (
        <div>
          <p className="mb-2 font-semibold text-ink">ชวนคิดเพิ่ม (คุยกับเพื่อนข้าง ๆ แล้วครูจะสุ่มถาม)</p>
          <ol className="list-decimal space-y-2 pl-6 text-lg">
            {step.items.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ทำขั้นนี้ครบแล้ว: แจ้งสั้น ๆ แล้วไปขั้นถัดไปเอง (ให้เห็นผลงาน/คะแนนก่อน)
function AutoAdvance({ label, onFire, delayMs = 2500 }: { label: string; onFire: () => void; delayMs?: number }) {
  const fire = useRef(onFire)
  fire.current = onFire
  useEffect(() => {
    const t = setTimeout(() => fire.current(), delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  return (
    <p role="status" className="mt-3 rounded-2xl bg-mint-400/20 px-4 py-3 text-center font-display text-emerald-800">
      ✓ ผ่านขั้นนี้แล้ว{label ? ` กำลังไปขั้น${label}…` : ''}
    </p>
  )
}

function AnswerBox({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-4 block space-y-2">
      <span className="block font-display text-brand-900">{label}</span>
      <textarea
        className="min-h-24 w-full rounded-2xl border-2 border-brand-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
        maxLength={500}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

type WorkItem = { kind: 'assignment'; assignment: AssignmentRow } | { kind: 'exam'; exam: ExamRow }

// ใบงาน/ข้อสอบของขั้นนี้ แสดงในหน้าคาบเลยทีละชิ้น — นักเรียนต้องส่งชิ้นนี้ก่อนจึงไปชิ้นถัดไปได้
function WorkPager({
  items,
  isStudent,
  sent,
  onSent,
}: {
  items: WorkItem[]
  isStudent: boolean
  sent: StepBodyProps['sent']
  onSent: StepBodyProps['onSent']
}) {
  const isSent = (it: WorkItem) =>
    it.kind === 'assignment'
      ? it.assignment.type === 'score_only' || !!sent?.submitted.includes(it.assignment.id)
      : !!sent?.examsDone.includes(it.exam.id)
  // เปิดที่ชิ้นแรกที่ยังไม่ได้ส่ง
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((it) => !isSent(it))))
  const i = Math.min(index, items.length - 1)
  const item = items[i]
  if (!item) return null
  const reachable = (n: number) => !isStudent || items.slice(0, n).every(isSent)
  const canNext = i < items.length - 1 && reachable(i + 1)
  const go = (n: number) => {
    if (!reachable(n)) return
    setIndex(n)
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  const id = item.kind === 'assignment' ? item.assignment.id : item.exam.id
  const title = item.kind === 'assignment' ? item.assignment.title : item.exam.title

  return (
    <div className="flex flex-col gap-4">
      {items.length > 1 && (
        <nav aria-label="ชิ้นงานในขั้นนี้" className="flex flex-wrap gap-2">
          {items.map((it, n) => {
            const itTitle = it.kind === 'assignment' ? it.assignment.title : it.exam.title
            const done = isSent(it)
            return (
              <button
                key={it.kind === 'assignment' ? it.assignment.id : it.exam.id}
                type="button"
                onClick={() => go(n)}
                disabled={!reachable(n)}
                aria-current={n === i ? 'step' : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-display disabled:cursor-not-allowed disabled:opacity-60 ${
                  n === i ? 'bg-brand-600 text-white' : done ? 'bg-mint-400/30 text-emerald-900' : 'bg-white text-slate-600 ring-1 ring-brand-100'
                }`}
              >
                {done ? '✓' : reachable(n) ? n + 1 : '🔒'} {it.kind === 'exam' ? '🎟️' : '📝'} {itTitle}
              </button>
            )
          })}
        </nav>
      )}
      <p className="text-sm text-slate-500">
        ชิ้นที่ {i + 1} จาก {items.length} · {title}
      </p>
      {isStudent ? (
        item.kind === 'assignment' ? (
          <AssignmentView key={id} id={id} embedded onSubmitted={() => onSent('assignment', id)} />
        ) : (
          <ExamView key={id} id={id} embedded onSubmitted={() => onSent('exam', id)} />
        )
      ) : (
        <TeacherWorkPreview item={item} />
      )}
      {items.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="secondary" disabled={i === 0} onClick={() => go(i - 1)}>
            ← ชิ้นก่อนหน้า
          </Button>
          {i < items.length - 1 && (
            <div className="flex flex-wrap items-center gap-3">
              {!canNext && <span className="text-sm text-amber-700">🔒 ส่งชิ้นนี้ก่อน จึงไปชิ้นถัดไปได้</span>}
              <Button disabled={!canNext} onClick={() => go(i + 1)}>
                ชิ้นถัดไป →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ครูดูตัวอย่าง: แสดงรายละเอียดชิ้นงาน (ครูไม่ได้ส่งงาน/ทำข้อสอบจากหน้านี้)
function TeacherWorkPreview({ item }: { item: WorkItem }) {
  if (item.kind === 'assignment') {
    const a = item.assignment
    return (
      <Panel title={`📝 ${a.title}`}>
        <p className="mb-2 text-sm text-slate-600">
          {a.max_score} คะแนน · {dueCountdown(a.due_at)}
        </p>
        {a.instructions_md && <Markdown text={a.instructions_md} />}
        <p className="mt-3 text-sm text-slate-500">นักเรียนจะเห็นช่องตอบและปุ่มส่งงานตรงนี้</p>
      </Panel>
    )
  }
  const e = item.exam
  return (
    <Panel title={`🎟️ ${e.title}`}>
      <p className="text-slate-600">
        {e.question_ids.length} ข้อ{e.duration_min ? ` · ${e.duration_min} นาที` : ''} · ทำได้ {e.max_attempts} ครั้ง
      </p>
      <p className="mt-3 text-sm text-slate-500">นักเรียนจะเห็นข้อสอบตรงนี้ทันทีโดยไม่ต้องกดเริ่ม</p>
    </Panel>
  )
}

function Panel({ title, character, children }: { title: string; character?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
      {character && <div className="hidden shrink-0 sm:block">{character}</div>}
      <div className="min-w-0 flex-1">
        <h2 className="mb-3 text-xl text-brand-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}
