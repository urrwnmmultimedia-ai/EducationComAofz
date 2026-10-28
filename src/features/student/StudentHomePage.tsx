import { Link } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Doctor } from '@/components/characters/Characters'
import { EmptyBlock, ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { levelFromXp } from '@/lib/levels'
import { useAsync } from '@/lib/useAsync'
import type { SessionListItem, UnitRow } from '@/lib/database.types'
import { fetchSessionList, fetchUnits } from '@/features/lessons/lessonsApi'
import { progressPercent } from '@/features/lessons/sessionSteps'
import { dueCountdown, fetchStudentStats } from './studentApi'
import { studentGreeting } from './greeting'

// คาบปัจจุบัน = คาบที่ครูปลดล็อกล่าสุด
function currentSession(list: SessionListItem[]): SessionListItem | null {
  return (
    list
      .filter((s) => s.is_unlocked)
      .sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? '') || b.session_no - a.session_no)[0] ?? null
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
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-lg sm:p-7">
        <Doctor className="size-20 shrink-0 rounded-full bg-white/20 sm:size-24" />
        <div>
          <h1 className="text-2xl sm:text-3xl">{studentGreeting(student)} 👋</h1>
          <p className="mt-1 text-brand-100">พร้อมเป็นนักออกแบบตัวจริงหรือยัง? วันนี้มีภารกิจรออยู่!</p>
        </div>
      </section>

      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorBlock message={state.error} onRetry={state.reload} />}
      {state.status === 'success' && <Dashboard {...state.data} />}
    </div>
  )
}

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

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 lg:col-span-2">
          <h2 className="text-lg text-brand-900">📍 คาบปัจจุบัน</h2>
          {current ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">คาบที่ {current.session_no}</p>
                <p className="font-display text-xl text-slate-800">{current.title}</p>
                <ProgressBar value={progressPercent([current])} className="mt-2 w-48" />
              </div>
              <Link
                to={`/sessions/${current.session_no}`}
                className="rounded-2xl bg-brand-600 px-5 py-2.5 font-display text-white shadow-[0_4px_0_0_var(--color-brand-900)]"
              >
                เข้าห้องเรียน →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-slate-500">ยังไม่มีคาบที่เปิด รอครูปลดล็อกในชั่วโมงเรียน</p>
          )}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
          <h2 className="text-lg text-brand-900">🏆 เลเวลของฉัน</h2>
          <p className="mt-2 font-display text-2xl text-brand-700">
            Lv.{level.level} {level.name}
          </p>
          <ProgressBar value={level.progress * 100} className="mt-2" />
          <p className="mt-1 text-sm text-slate-500">
            {stats.totalXp} XP · อีก {level.xpToNext} XP ขึ้นเลเวล
          </p>
          <p className="mt-2 text-sm text-slate-600">เหรียญที่ได้: {stats.badgeCount}</p>
          <Link to="/games" className="mt-3 inline-block font-display text-brand-700 underline underline-offset-4">
            🎮 ไปเล่นเกม
          </Link>
        </section>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
        <h2 className="text-lg text-brand-900">📝 งานค้าง</h2>
        {stats.pending.length === 0 ? (
          <p className="mt-2 text-slate-500">ไม่มีงานค้าง เยี่ยมมาก! 🎉</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {stats.pending.slice(0, 5).map((a) => {
              const due = dueCountdown(a.due_at)
              return (
                <li key={a.id}>
                  <Link
                    to={`/assignments/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3 hover:bg-brand-100"
                  >
                    <span className="font-display text-slate-800">{a.title}</span>
                    <span className={`text-sm ${due.startsWith('เลย') ? 'text-rose-600' : 'text-slate-600'}`}>{due}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg text-brand-900">📚 หน่วยการเรียนรู้</h2>
        {units.length === 0 ? (
          <EmptyBlock>ยังไม่มีหน่วยการเรียนรู้</EmptyBlock>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {units.map((u) => {
              const pct = progressPercent(sessions.filter((s) => s.unit_id === u.id))
              return (
                <Link
                  key={u.id}
                  to={`/units/${u.no}`}
                  className="flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="font-display text-sm text-brand-600">หน่วยที่ {u.no}</span>
                  <span className="font-display text-lg text-slate-800">{u.title}</span>
                  <ProgressBar value={pct} className="mt-auto" />
                  <span className="text-sm text-slate-500">ความคืบหน้า {pct}%</span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-brand-100">
        <Link to="/scores" className="font-display text-brand-700 underline underline-offset-4">
          ดูสมุดคะแนนของฉัน
        </Link>{' '}
        — ดูคะแนนเก็บ คะแนนสอบ และเกรดคาดการณ์
      </section>
    </>
  )
}
