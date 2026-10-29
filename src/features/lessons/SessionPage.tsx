import { useState, type ReactNode } from 'react'
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
import { LessonCards } from './LessonCards'
import { Markdown } from './Markdown'
import { type SessionStep, type StepKey } from './sessionSteps'
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
  const { detail, steps, completed, setCompleted, checkedIn, savingStep, saveError, completeStep } = useSessionPage(sessionNo, isStudent)
  const [search] = useSearchParams()
  const location = useLocation()
  // ?step=work เปิดขั้นนั้น · ?after=game เปิดขั้นถัดจากเกม (กลับมาจากเกม/งาน/ข้อสอบ)
  // ขั้นที่กดเลือกเองใช้ได้เฉพาะ URL เดิม — กลับมาด้วยลิงก์ ?after= ใหม่ ให้ URL เป็นตัวกำหนด
  const [pickedAt, setPickedAt] = useState<{ loc: string; step: StepKey } | null>(null)
  const picked = pickedAt?.loc === location.key ? pickedAt.step : null
  const [guess, setGuess] = useGuess(sessionNo)

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
  const current = steps.find((s) => s.key === (wanted ?? firstOpen)) ?? steps[0]
  const doneCount = steps.filter((s) => completed.includes(s.key)).length
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0
  const currentIdx = current ? steps.indexOf(current) : -1
  const prev = steps[currentIdx - 1]
  const next = steps[currentIdx + 1]
  const currentDone = !!current && completed.includes(current.key)

  // คาบที่ครูเปิดแล้ว เลือกได้ทุกขั้นทุกเมื่อ ไม่ต้องทำตามลำดับ
  const setActive = (step: StepKey) => {
    setPickedAt({ loc: location.key, step })
    scrollTo({ top: 0, behavior: 'smooth' })
  }
  // ทำขั้นนี้เสร็จ (นักเรียนบันทึกผล ครูแค่เลื่อนไปขั้นถัดไป)
  const finishCurrent = async () => {
    if (!current) return
    if (isStudent && !currentDone) await completeStep(current.key)
    if (next) setActive(next.key)
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/home" className="hover:text-brand-700">
          หน้าหลัก
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
            {checkedIn && <span className="rounded-full bg-mint-400 px-3 py-0.5 font-display text-emerald-950">เช็คชื่อแล้ว +10 XP</span>}
          </div>
        )}
      </header>

      <StepJourney
        label="ขั้นตอนในคาบ"
        steps={steps.map((s) => ({ key: s.key, label: s.label, icon: STEP_ICON[s.key] }))}
        current={current?.key ?? ''}
        done={new Set(completed)}
        onSelect={(k) => setActive(k as StepKey)}
      />

      {!isStudent && (
        <p className="rounded-2xl bg-sun-300/40 px-4 py-2 text-sm text-amber-900">
          โหมดครู: เมื่อครูเปิดคาบ นักเรียนเข้าได้ทุกขั้น ทุกการ์ด เกม งาน และ Exit ticket ทันที ไม่ต้องทำตามลำดับ (ครูดูตัวอย่างไม่บันทึกผล)
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
            examsInWork={!steps.some((x) => x.key === 'exit')}
            workLabel={session.work_label}
            gameSlug={session.game_slug}
            sessionNo={session.session_no}
            isStudent={isStudent}
            guess={guess}
            onGuess={setGuess}
            onLessonDone={() => void finishCurrent()}
            onGameStepDone={setCompleted}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {prev ? (
              <Button variant="secondary" onClick={() => setActive(prev.key)}>
                ← {prev.label}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {saveError && <span className="text-sm text-rose-600">{saveError}</span>}
              {isStudent && currentDone && <span className="font-display text-mint-500">ทำขั้นนี้แล้ว ✓</span>}
              {(next || (isStudent && !currentDone)) && (
                <Button loading={savingStep === current.key} onClick={() => void finishCurrent()}>
                  {isStudent && !currentDone ? (next ? `ทำเสร็จแล้ว ไปขั้น${next.label} →` : 'จบคาบ ✓') : `ไปขั้น${next?.label ?? 'ถัดไป'} →`}
                </Button>
              )}
            </div>
          </div>
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
  guess: string
  onGuess: (g: string) => void
  onLessonDone: () => void
  onGameStepDone: (completed: string[]) => void
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
  guess,
  onGuess,
  onLessonDone,
  onGameStepDone,
}: StepBodyProps) {
  switch (step.key) {
    case 'warmup':
      if (step.question) return <OpeningStep step={step} guess={guess} onGuess={onGuess} />
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
          <p className="mt-4 text-sm text-slate-500">คิดคำตอบในใจ หรือคุยกับเพื่อนข้าง ๆ แล้วครูจะสุ่มถาม</p>
        </Panel>
      )
    case 'content':
      return lessons.length === 0 ? (
        <EmptyBlock>ครูยังไม่ได้ใส่เนื้อหาคาบนี้</EmptyBlock>
      ) : (
        <div className="flex flex-col gap-6">
          {lessons.map((l, i) => (
            <LessonCards key={l.id} title={l.title} markdown={l.content_md} onFinished={i === lessons.length - 1 ? onLessonDone : undefined} />
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
    case 'work':
      return (
        <Panel title="งาน / กิจกรรม">
          {workLabel && <p className="mb-3 font-display text-brand-900">{workLabel}</p>}
          {examsInWork && exams.length > 0 && (
            <div className="mb-4">
              <ExamLinks exams={exams} />
            </div>
          )}
          {assignments.length === 0 ? (
            <p className="text-slate-500">ครูยังไม่ได้เปิดงานในเว็บสำหรับคาบนี้</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {assignments.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/assignments/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3 hover:bg-brand-100"
                  >
                    <span className="font-display text-brand-900">{a.title}</span>
                    <span className="text-sm text-slate-600">
                      {a.max_score} คะแนน · {dueCountdown(a.due_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )
    case 'exit':
      return (
        <Panel title="Exit ticket และแบบทดสอบ">
          <p>ตอบคำถามท้ายคาบ ตอบถูกครบรับ +20 XP</p>
          <ExamLinks exams={exams} />
        </Panel>
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
        </Panel>
      )
  }
}

// ขั้นเปิดคาบแบบ DB Quest: คำถามใหญ่ → ตอบตามที่คิด (ไม่มีถูกผิด) → เรียนไปทำไม → เป้าหมาย → ชวนคิดเพิ่ม
function OpeningStep({ step, guess, onGuess }: { step: SessionStep; guess: string; onGuess: (g: string) => void }) {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-action to-action-strong p-5 pr-24 text-white sm:p-6 sm:pr-32">
        <NamWan className="pointer-events-none absolute -bottom-2 -right-2 size-24 drop-shadow-lg sm:size-28" />
        <p className="text-sm font-semibold text-brand-100">คำถามก่อนเรียน</p>
        <p className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{step.question}</p>
      </div>
      <label className="block space-y-2">
        <span className="block font-display text-brand-900">คำตอบของฉัน (ก่อนเรียน) — ตอบตามที่คิด ไม่มีถูกผิด</span>
        <textarea
          className="min-h-24 w-full rounded-2xl border-2 border-brand-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
          maxLength={500}
          placeholder="ตอบสั้น ๆ ตามที่คิด ท้ายคาบจะกลับมาดูกันอีกที"
          value={guess}
          onChange={(e) => onGuess(e.target.value)}
        />
      </label>
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

function ExamLinks({ exams }: { exams: ExamRow[] }) {
  if (exams.length === 0) return <p className="mt-2 text-sm text-slate-500">คาบนี้ยังไม่มีแบบทดสอบ</p>
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {exams.map((e) => (
        <li key={e.id}>
          <Link to={`/exams/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3 hover:bg-brand-100">
            <span className="font-display text-brand-900">🎟️ {e.title}</span>
            <span className="text-sm text-slate-600">
              {e.question_ids.length} ข้อ{e.duration_min ? ` · ${e.duration_min} นาที` : ''}
            </span>
          </Link>
        </li>
      ))}
    </ul>
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
