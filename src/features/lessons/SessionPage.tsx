import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { NamWan, Non } from '@/components/characters/Characters'
import { EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import type { AssignmentRow, ExamRow } from '@/lib/database.types'
import { dueCountdown } from '@/features/student/studentApi'
import { LessonCards } from './LessonCards'
import { totalMinutes, type SessionStep, type StepKey } from './sessionSteps'
import { useSessionPage } from './useSessionPage'

const STEP_ICON: Record<StepKey, string> = {
  warmup: '🔥',
  content: '📖',
  game: '🎮',
  work: '✍️',
  exit: '🎟️',
  summary: '⭐',
}

export function SessionPage() {
  const params = useParams()
  const sessionNo = Number(params.no)
  const { identity } = useAuth()
  const isStudent = identity.role === 'student'
  const { detail, steps, completed, checkedIn, savingStep, saveError, completeStep } = useSessionPage(sessionNo, isStudent)
  const [active, setActive] = useState<StepKey>('warmup')

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
  const current = steps.find((s) => s.key === active) ?? steps[0]
  const doneCount = steps.filter((s) => completed.includes(s.key)).length
  const percent = steps.length ? Math.round((doneCount / steps.length) * 100) : 0

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
          คาบที่ {session.session_no} · {totalMinutes(steps)} นาที
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

      <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-6 sm:px-0" aria-label="ขั้นตอนในคาบ">
        {steps.map((s, i) => {
          const done = completed.includes(s.key)
          const isActive = s.key === current?.key
          return (
            <li key={s.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(s.key)}
                aria-current={isActive ? 'step' : undefined}
                className={`flex w-28 flex-col items-center gap-0.5 rounded-2xl px-2 py-2.5 text-center transition sm:w-full ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md'
                    : done
                      ? 'bg-mint-400/20 text-emerald-800 ring-1 ring-mint-400'
                      : 'bg-white text-slate-700 ring-1 ring-brand-100 hover:bg-brand-50'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {done && !isActive ? '✅' : STEP_ICON[s.key]}
                </span>
                <span className="font-display text-sm leading-tight">
                  {i + 1}. {s.label}
                </span>
                <span className={`text-xs ${isActive ? 'text-brand-100' : 'text-slate-500'}`}>{s.minutes} นาที</span>
              </button>
            </li>
          )
        })}
      </ol>

      {current && (
        <section aria-live="polite">
          <StepBody
            step={current}
            lessons={lessons}
            assignments={assignments}
            exams={exams}
            examsInWork={!steps.some((x) => x.key === 'exit')}
            workLabel={session.work_label}
            gameSlug={session.game_slug}
          />
          {isStudent && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {saveError && <span className="text-sm text-rose-600">{saveError}</span>}
              {completed.includes(current.key) ? (
                <span className="font-display text-mint-500">ทำขั้นนี้แล้ว ✓</span>
              ) : (
                <Button
                  variant="secondary"
                  loading={savingStep === current.key}
                  onClick={() => void completeStep(current.key)}
                >
                  ทำขั้นนี้เสร็จแล้ว
                </Button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

interface StepBodyProps {
  step: SessionStep
  lessons: { id: string; title: string; content_md: string }[]
  assignments: AssignmentRow[]
  exams: ExamRow[]
  examsInWork: boolean // คาบที่ไม่มีขั้น Exit ticket (เช่น คาบสอบ) แสดงชุดสอบในขั้นงาน
  workLabel: string
  gameSlug: string | null
}

function StepBody({ step, lessons, assignments, exams, examsInWork, workLabel, gameSlug }: StepBodyProps) {
  switch (step.key) {
    case 'warmup':
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
          {lessons.map((l) => (
            <LessonCards key={l.id} title={l.title} markdown={l.content_md} />
          ))}
        </div>
      )
    case 'game':
      return (
        <Panel character={<Non className="size-16" />} title="เวลาเล่นเกม!">
          {gameSlug ? (
            <>
              <p>เกมประจำคาบนี้พร้อมให้ลองแล้ว เล่นครั้งแรกได้ XP เต็ม</p>
              <Link
                to={`/games/${gameSlug}`}
                className="mt-4 inline-flex rounded-2xl bg-brand-600 px-5 py-2.5 font-display text-white shadow-[0_4px_0_0_var(--color-brand-900)]"
              >
                🎮 ไปเล่นเกม
              </Link>
            </>
          ) : (
            <p className="text-slate-500">คาบนี้ไม่มีเกม ใช้เวลาทำกิจกรรมเพิ่ม</p>
          )}
        </Panel>
      )
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
