import { Link } from 'react-router'
import { ArrowRight, BookOpen, ChevronRight, CircleCheck, ClipboardList, Flame, Gamepad2, PencilLine, Star, Ticket } from 'lucide-react'
import { Doctor } from '@/components/characters/Characters'
import { EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { StepPreview } from '@/components/StepJourney'
import { levelFromXp } from '@/lib/levels'
import { useAsync } from '@/lib/useAsync'
import type { SessionListItem, UnitRow } from '@/lib/database.types'
import { fetchSessionList, fetchUnits } from '@/features/lessons/lessonsApi'
import { courseProgressPercent, progressPercent } from '@/features/lessons/sessionSteps'
import { EvolutionSlot } from '@/components/evolution/ScoreEvolutionCard'
import { EvolutionCardM3 } from './EvolutionCardM3'
import { fetchMyScore } from './myScore'
import { dueCountdown, fetchStudentStats } from './studentApi'
import { useViewer } from './viewer'

// คาบปัจจุบัน = คาบที่ครูปลดล็อกล่าสุด
function currentSession(list: SessionListItem[]): SessionListItem | null {
  return (
    list.filter((s) => s.is_unlocked).sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? '') || b.session_no - a.session_no)[0] ??
    null
  )
}

export function StudentHomePage() {
  const { student } = useViewer()
  const studentId = student?.id ?? ''
  const state = useAsync(async () => {
    const [units, sessions, stats, mine] = await Promise.all([fetchUnits(), fetchSessionList(), fetchStudentStats(studentId), fetchMyScore(studentId)])
    return { units, sessions, stats, score: mine.score.total }
  }, [studentId])

  if (!student) return null

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl leading-tight text-ink sm:text-2xl">สวัสดี {student.nickname || student.first_name}</h1>
        <p className="mt-0.5 text-ink-2">
          {student.classroom_name ?? 'ยังไม่ระบุห้อง'}
          {student.number != null && ` · เลขที่ ${student.number}`}
        </p>
      </header>

      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorBlock message={state.error} onRetry={state.reload} />}
      {state.status === 'success' && <Dashboard {...state.data} />}
    </div>
  )
}

// 6 ขั้นในทุกคาบของ ม.3 (แสดงในการ์ดเรียนต่อ)
const M3_STEPS = [
  { label: 'อุ่นเครื่อง', icon: Flame },
  { label: 'เนื้อหา', icon: BookOpen },
  { label: 'เกม', icon: Gamepad2 },
  { label: 'งาน', icon: PencilLine },
  { label: 'Exit ticket', icon: Ticket },
  { label: 'สรุป', icon: Star },
]

const row = 'tq-press flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-surface/70'

function Dashboard({
  units,
  sessions,
  stats,
  score,
}: {
  units: UnitRow[]
  sessions: SessionListItem[]
  stats: Awaited<ReturnType<typeof fetchStudentStats>>
  score: number // คะแนนรวม 0–100 จากสมุดคะแนน (ใช้กับวิวัฒนาการ)
}) {
  const current = currentSession(sessions)
  const level = levelFromXp(stats.totalXp)
  const pct = current ? progressPercent([current]) : 0
  const currentUnit = current ? units.find((u) => u.id === current.unit_id) : undefined

  return (
    <>
      {/* minmax(0, …): คอลัมน์ไม่ถูกข้อความบรรทัดเดียวในการ์ดวิวัฒนาการดันจนล้นขวา */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* การ์ดหลัก: สิ่งเดียวที่ควรทำต่อ — แผ่นซ้อนด้านหลัง + ตัวละครยื่นออกนอกขอบ */}
        <div className="tq-stack mb-4 mt-3 flex min-w-0 flex-col sm:mt-6 lg:mb-6 lg:mt-10">
          <section className="tq-card tq-arrive relative flex flex-1 flex-col p-5 pr-24 sm:p-8 sm:pr-40">
            <Doctor className="pointer-events-none absolute -right-2 -top-5 size-24 drop-shadow-xl sm:-right-4 sm:-top-9 sm:size-32 lg:-right-6 lg:-top-14 lg:size-44" />
            {current ? (
              <>
                <h2 className="text-[1.6rem] leading-[1.25] text-ink sm:text-[2.1rem] lg:text-[2.6rem]">{current.title}</h2>
                <p className="mt-2 text-ink-2">คาบที่ {current.session_no} · เรียนต่อจากที่ค้างไว้</p>
                <div className="mt-4 flex max-w-sm items-center gap-3">
                  <ProgressBar value={pct} className="flex-1" />
                  <span className="text-sm font-semibold tabular-nums text-ink-2">{pct}%</span>
                </div>
                <div className="mt-5 space-y-2.5">
                  {currentUnit && (
                    <p className="text-sm font-semibold text-m3-700">
                      หน่วยที่ {currentUnit.no} · {currentUnit.title}
                    </p>
                  )}
                  <StepPreview steps={M3_STEPS} />
                </div>
                <div className="mt-auto flex flex-wrap gap-3 pt-6">
                  <Link
                    to={`/sessions/${current.session_no}`}
                    className="tq-press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-action px-6 text-base font-semibold text-white shadow-action hover:-translate-y-px hover:bg-brand-600"
                  >
                    เข้าห้องเรียน
                    <ArrowRight className="size-5" aria-hidden />
                  </Link>
                  <LessonsButton />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl text-ink">ยังไม่มีคาบที่เปิด</h2>
                <p className="mt-2 text-ink-2">รอครูปลดล็อกในชั่วโมงเรียน ระหว่างนี้ดูบทเรียนทั้งหมดได้</p>
                <div className="mt-5">
                  <LessonsButton />
                </div>
              </>
            )}
          </section>
        </div>

        {/* วิวัฒนาการตามคะแนนรวม (ลิง → คน) + XP/เหรียญ */}
        <EvolutionSlot fit={!!current}>
          <EvolutionCardM3
            score={score}
            compact
            info={{
              level: `Lv.${level.level} ${level.name}`,
              xp: stats.totalXp,
              badges: String(stats.badgeCount),
              pending: stats.pending.length,
              progressPct: courseProgressPercent(sessions),
              nextDue: stats.pending[0]
                ? { title: stats.pending[0].title, to: `/assignments/${stats.pending[0].id}`, when: dueCountdown(stats.pending[0].due_at) }
                : null,
            }}
          />
        </EvolutionSlot>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="tq-card p-5 sm:p-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-lg text-ink">งานค้าง</h2>
            <Link to="/profile?tab=scores" className="text-sm font-semibold text-action-strong hover:underline">
              สมุดคะแนน
            </Link>
          </div>
          {stats.pending.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-ink-2">
              <CircleCheck className="size-5 text-mint-500" aria-hidden /> ไม่มีงานค้าง เยี่ยมมาก
            </p>
          ) : (
            <ul className="-mx-3">
              {stats.pending.slice(0, 5).map((a) => {
                const due = dueCountdown(a.due_at)
                const late = due.startsWith('เลย')
                return (
                  <li key={a.id}>
                    <Link to={`/assignments/${a.id}`} className={row}>
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl ${late ? 'bg-rose-50 text-rose-600' : 'bg-surface text-ink-2'}`}
                      >
                        <ClipboardList className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{a.title}</span>
                        <span className={`text-sm ${late ? 'text-rose-700' : 'text-ink-2'}`}>{due}</span>
                      </span>
                      <ChevronRight className="size-5 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="tq-card p-5 sm:p-6">
          <h2 className="mb-2 text-lg text-ink">หน่วยการเรียนรู้</h2>
          {units.length === 0 ? (
            <EmptyBlock>ยังไม่มีหน่วยการเรียนรู้</EmptyBlock>
          ) : (
            <ul className="-mx-3">
              {units.map((u) => {
                const p = progressPercent(sessions.filter((s) => s.unit_id === u.id))
                return (
                  <li key={u.id}>
                    <Link to={`/units/${u.no}`} className={row}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-m3-50 text-base font-bold text-m3-700">{u.no}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{u.title}</span>
                        <span className="mt-1 flex items-center gap-2">
                          <ProgressBar value={p} className="h-1.5 flex-1" />
                          <span className="w-10 text-right text-xs tabular-nums text-ink-2">{p}%</span>
                        </span>
                      </span>
                      <ChevronRight className="size-5 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

// ปุ่มรอง "บทเรียน" (ข้างปุ่มเข้าห้องเรียน): ปุ่มขาวนูน → หน้ารายการคาบทั้งหมด
function LessonsButton() {
  return (
    <Link
      to="/lessons"
      className="tq-press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-b from-white to-surface px-5 text-base font-semibold text-action-strong shadow-[inset_0_1px_0_#fff,0_4px_0_#c9d8f2,0_12px_20px_-12px_rgb(20_45_100/0.5)] ring-1 ring-line hover:-translate-y-px"
    >
      <BookOpen className="size-5" aria-hidden />
      บทเรียน
    </Link>
  )
}
