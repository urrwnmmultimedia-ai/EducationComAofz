import { Link } from 'react-router'
import { ArrowRight, Bell, BookOpen, ChevronRight, CircleCheck, ClipboardList, Flag, Gamepad2, PencilLine } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { NongData } from '@/components/illustrations/NongData'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { course } from '@/content/course'
import { useAsync } from '@/lib/useAsync'
import { fetchMap, type MapItem } from '../lesson/dbqLessonApi'
import { StepPreview } from '@/components/StepJourney'
import { EvolutionSlot } from '@/components/evolution/ScoreEvolutionCard'
import { EvolutionCard } from '../EvolutionCard'
import { unitIcon } from '../unitIcons'
import { fetchMe, fetchMyScores } from './dbqStudentApi'

// คาบที่ควรเรียนต่อ: คาบเนื้อหาที่เปิดแล้วแต่ยังไม่ครบ ตัวแรก (ถ้าครบหมด = คาบเปิดล่าสุด)
export function nextSession(map: MapItem[]): MapItem | undefined {
  return map.find((m) => m.open && m.kind === 'lesson' && (m.pct ?? 0) < 100) ?? [...map].reverse().find((m) => m.open)
}

// ความคืบหน้าทั้งวิชา (0–100): เฉลี่ยทุกคาบเนื้อหา รวมคาบที่ยังไม่เปิด (นับเป็น 0)
function courseProgress(map: MapItem[]): number {
  const lessons = map.filter((m) => m.kind === 'lesson')
  return lessons.length ? Math.round(lessons.reduce((s, m) => s + (m.pct ?? 0), 0) / lessons.length) : 0
}

// 6 ขั้นในทุกคาบ (แสดงในการ์ดเรียนต่อ)
const DBQ_STEPS = [
  { label: 'เปิดคาบ', icon: Bell },
  { label: 'บทเรียน', icon: BookOpen },
  { label: 'ฝึก', icon: PencilLine },
  { label: 'เกม', icon: Gamepad2 },
  { label: 'ใบงาน', icon: ClipboardList },
  { label: 'ปิดคาบ', icon: Flag },
]

const row = 'tq-press flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-surface/70 dark:hover:bg-dq-800'
const card = 'tq-card dark:bg-dq-900 dark:ring-dq-800'

// หน้าหลัก DB Quest — ไวยากรณ์เดียวกับหน้าหลัก ม.3: การ์ดเรียนต่อ + เลเวล แล้วตามด้วยแถวงานค้าง/หน่วย
export function DbqHomePage() {
  const { identity } = useAuth()
  const name = identity.student?.nickname || identity.student?.first_name
  const res = useAsync(() => Promise.all([fetchMap(), fetchMe(), fetchMyScores()]), [])

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl leading-tight text-ink sm:text-2xl dark:text-white">{name ? `สวัสดี ${name}` : 'DB Quest'}</h1>
        <p className="mt-0.5 text-base text-ink-2 dark:text-dq-300">DB Quest · 7 หน่วย 20 คาบ</p>
      </header>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' && <Home map={res.data[0]} xp={res.data[1].xp} badges={res.data[1].badges.length} scores={res.data[2]} />}
    </div>
  )
}

function Home({ map, xp, badges, scores }: { map: MapItem[]; xp: number; badges: number; scores: Awaited<ReturnType<typeof fetchMyScores>> }) {
  const next = nextSession(map)
  const pending = scores.preview ? [] : scores.assignments.filter((a) => a.open && a.status === 'missing')
  const byNo = new Map(map.map((m) => [m.session_no, m]))
  const nextUnit = next ? course.units.find((u) => u.no === next.unit_no) : undefined
  const UnitIcon = unitIcon(nextUnit?.no ?? 1)

  return (
    <>
      {/* minmax(0, …): คอลัมน์ไม่ถูกข้อความบรรทัดเดียวในการ์ดวิวัฒนาการดันจนล้นขวา */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {next ? (
          <div className="tq-stack mb-4 mt-3 flex min-w-0 flex-col sm:mt-6 lg:mb-6 lg:mt-10">
            <section className={`${card} tq-arrive relative flex flex-1 flex-col p-5 pr-24 sm:p-8 sm:pr-44`}>
              <NongData
                mood="cheer"
                className="pointer-events-none absolute -right-2 -top-5 size-24 drop-shadow-xl sm:-right-3 sm:-top-9 sm:size-32 lg:-right-4 lg:-top-14 lg:size-40"
              />
              <h2 className="text-[1.6rem] leading-[1.25] text-ink sm:text-[2.1rem] lg:text-[2.6rem] dark:text-white">{next.title}</h2>
              <p className="mt-2 text-base text-ink-2 dark:text-dq-300">
                คาบ {next.session_no} · {next.pct ? `ทำไปแล้ว ${next.pct}%` : 'ยังไม่ได้เริ่ม'}
              </p>
              {next.pct != null && (
                <div className="mt-4 flex max-w-sm items-center gap-3">
                  <ProgressBar value={next.pct} className="flex-1" />
                  <span className="text-sm font-semibold tabular-nums text-ink-2 dark:text-dq-300">{next.pct}%</span>
                </div>
              )}
              <div className="mt-5 space-y-2.5">
                {nextUnit && (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-db-700 dark:text-db-200">
                    <UnitIcon className="size-4" aria-hidden /> หน่วย {nextUnit.no} · {nextUnit.title}
                  </p>
                )}
                <StepPreview steps={DBQ_STEPS} />
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                <Link
                  to={`/db/lesson/${next.session_no}`}
                  className="tq-press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-action px-6 text-base font-semibold text-white shadow-action hover:-translate-y-px hover:bg-brand-600"
                >
                  {next.pct ? 'เรียนต่อ' : 'เริ่มเรียน'}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
                <Link
                  to="/db/map"
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl px-3 font-semibold text-ink-2 hover:bg-surface dark:text-dq-200 dark:hover:bg-dq-800"
                >
                  <BookOpen className="size-5" aria-hidden /> บทเรียนทั้งหมด
                </Link>
              </div>
            </section>
          </div>
        ) : (
          <section className={`${card} p-6`}>
            <h2 className="text-2xl text-ink dark:text-white">ยังไม่มีคาบที่เปิด</h2>
            <p className="mt-2 text-ink-2 dark:text-dq-300">รอครูปลดล็อกในชั่วโมงเรียน</p>
          </section>
        )}

        <EvolutionSlot fit={!!next}>
          <EvolutionCard
            score={scores.preview ? 0 : scores.scores.total}
            compact
            info={{
              xp,
              badges: String(badges),
              pending: pending.length,
              progressPct: courseProgress(map),
              nextDue: pending[0]
                ? { title: pending[0].title, to: '/db/assignments', when: pending[0].session_no ? `คาบ ${pending[0].session_no}` : 'ส่งได้เลย' }
                : null,
            }}
          />
        </EvolutionSlot>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} p-5 sm:p-6`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-lg text-ink dark:text-white">งานค้าง</h2>
            <Link to="/db/assignments" className="text-sm font-semibold text-action-strong hover:underline dark:text-brand-300">
              ดูทั้งหมด
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-ink-2 dark:text-dq-300">
              <CircleCheck className="size-5 text-mint-500" aria-hidden /> ไม่มีงานค้าง เยี่ยมมาก
            </p>
          ) : (
            <ul className="-mx-3">
              {pending.slice(0, 5).map((a) => (
                <li key={a.item_id}>
                  <Link to={`/db/lesson/${a.session_no}`} className={row}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-ink-2 dark:bg-dq-800 dark:text-dq-200">
                      <ClipboardList className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink dark:text-white">{a.title}</span>
                      <span className="text-sm text-ink-2 dark:text-dq-300">คาบ {a.session_no} · ยังไม่ส่ง</span>
                    </span>
                    <ChevronRight className="size-5 text-slate-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} p-5 sm:p-6`}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-lg text-ink dark:text-white">หน่วยการเรียนรู้</h2>
            <Link to="/db/map" className="text-sm font-semibold text-action-strong hover:underline dark:text-brand-300">
              ดูทั้งหมด
            </Link>
          </div>
          <ul className="-mx-3">
            {course.units.map((u) => {
              const lessons = course.sessions.filter((s) => s.unit === u.no && s.kind === 'lesson')
              const pct = Math.round(lessons.reduce((sum, s) => sum + (byNo.get(s.no)?.pct ?? 0), 0) / Math.max(1, lessons.length))
              const open = lessons.some((s) => byNo.get(s.no)?.open)
              const Icon = unitIcon(u.no)
              const first = lessons[0]
              const body = (
                <>
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${open ? 'bg-db-50 text-db-700 dark:bg-db-700/30 dark:text-db-100' : 'bg-surface text-slate-400 dark:bg-dq-800'}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-semibold ${open ? 'text-ink dark:text-white' : 'text-slate-500'}`}>
                      หน่วย {u.no} · {u.title}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <ProgressBar value={pct} className="h-1.5 flex-1" />
                      <span className="w-10 text-right text-xs tabular-nums text-ink-2 dark:text-dq-300">{pct}%</span>
                    </span>
                  </span>
                </>
              )
              return (
                <li key={u.no}>
                  {open && first ? (
                    <Link to={`/db/lesson/${first.no}`} className={row}>
                      {body}
                      <ChevronRight className="size-5 text-slate-400" aria-hidden />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <details className={`${card} p-5 sm:p-6`}>
        <summary className="cursor-pointer text-lg font-semibold text-ink dark:text-white">เรียนจบแล้วเราจะทำอะไรได้</summary>
        <ol className="mt-3 space-y-2">
          {course.objectives.map((o) => (
            <li key={o.no} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-db-50 text-sm font-bold text-db-700 dark:bg-db-700/30 dark:text-db-100">
                {o.no}
              </span>
              <span className="text-base leading-relaxed">{o.text}</span>
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}
