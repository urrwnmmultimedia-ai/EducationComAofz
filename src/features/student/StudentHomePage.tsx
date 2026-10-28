import { Link } from 'react-router'
import { ArrowRight, Award, BookOpen, ChevronRight, CircleCheck, ClipboardList, Flame, Gamepad2, PencilLine, Star, Ticket } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Doctor } from '@/components/characters/Characters'
import { EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { StepPreview } from '@/components/StepJourney'
import { levelFromXp } from '@/lib/levels'
import { useAsync } from '@/lib/useAsync'
import type { SessionListItem, UnitRow } from '@/lib/database.types'
import { fetchSessionList, fetchUnits } from '@/features/lessons/lessonsApi'
import { progressPercent } from '@/features/lessons/sessionSteps'
import { dueCountdown, fetchStudentStats } from './studentApi'

// คาบปัจจุบัน = คาบที่ครูปลดล็อกล่าสุด
function currentSession(list: SessionListItem[]): SessionListItem | null {
  return (
    list.filter((s) => s.is_unlocked).sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? '') || b.session_no - a.session_no)[0] ??
    null
  )
}

export function StudentHomePage() {
  const { identity } = useAuth()
  const student = identity.student
  const studentId = student?.id ?? ''
  const state = useAsync(async () => {
    const [units, sessions, stats] = await Promise.all([fetchUnits(), fetchSessionList(), fetchStudentStats(studentId)])
    return { units, sessions, stats }
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
}: {
  units: UnitRow[]
  sessions: SessionListItem[]
  stats: Awaited<ReturnType<typeof fetchStudentStats>>
}) {
  const current = currentSession(sessions)
  const level = levelFromXp(stats.totalXp)
  const pct = current ? progressPercent([current]) : 0
  const currentUnit = current ? units.find((u) => u.id === current.unit_id) : undefined

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* การ์ดหลัก: สิ่งเดียวที่ควรทำต่อ — แผ่นซ้อนด้านหลัง + ตัวละครยื่นออกนอกขอบ */}
        <div className="tq-stack mb-4 mt-3 flex flex-col sm:mt-6 lg:mb-6 lg:mt-10">
          <section className="tq-card tq-arrive relative flex flex-1 flex-col p-5 pr-24 sm:p-8 sm:pr-44">
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
                <div className="mt-auto pt-6">
                  <Link
                    to={`/sessions/${current.session_no}`}
                    className="tq-press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-action px-6 text-base font-semibold text-white shadow-action hover:-translate-y-px hover:bg-brand-600"
                  >
                    เข้าห้องเรียน
                    <ArrowRight className="size-5" aria-hidden />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl text-ink">ยังไม่มีคาบที่เปิด</h2>
                <p className="mt-2 text-ink-2">รอครูปลดล็อกในชั่วโมงเรียน ระหว่างนี้ไปเล่นเกมทบทวนได้</p>
                <Link
                  to="/games"
                  className="tq-press mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-semibold text-ink ring-1 ring-line"
                >
                  <Gamepad2 className="size-5" aria-hidden /> ไปที่เกม
                </Link>
              </>
            )}
          </section>
        </div>

        {/* เลเวล */}
        <section className="tq-card flex flex-col gap-4 self-start p-5 sm:p-6 lg:mt-10">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-xp-300/50 text-xp-600">
              <Award className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm text-ink-2">เลเวลของฉัน</p>
              <p className="text-xl font-semibold text-ink">
                Lv.{level.level} {level.name}
              </p>
            </div>
          </div>
          <div>
            <div
              className="h-3 overflow-hidden rounded-full bg-surface"
              role="progressbar"
              aria-valuenow={Math.round(level.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="ความคืบหน้าเลเวล"
            >
              <div className="h-full rounded-full bg-xp-500" style={{ width: `${level.progress * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-2">
              <span className="font-semibold tabular-nums text-ink">{stats.totalXp}</span> XP · อีก {level.xpToNext} XP ขึ้นเลเวล
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
            <span className="text-ink-2">
              เหรียญที่ได้ <span className="font-semibold text-ink">{stats.badgeCount}</span>
            </span>
            <Link to="/profile" className="font-semibold text-action-strong hover:underline">
              ดูเหรียญ
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="tq-card p-5 sm:p-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-lg text-ink">งานค้าง</h2>
            <Link to="/scores" className="text-sm font-semibold text-action-strong hover:underline">
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
