import { Link } from 'react-router'
import { ArrowRight, CircleCheck, Lock } from 'lucide-react'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { course, type CourseSession } from '@/content/course'
import { useAsync } from '@/lib/useAsync'
import { fetchMap, type MapItem } from '../lesson/dbqLessonApi'
import { sessionIcon } from '../unitIcons'
import { nextSession } from './DbqHomePage'

// ครูปลดล็อกแล้ว = มีปุ่มเริ่ม/เรียนต่อทุกคาบ · ล็อก = ไม่มีปุ่ม กดไม่ได้
function Status({ item }: { item?: MapItem }) {
  if (!item || !item.open)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-slate-500 dark:text-dq-300">
        <Lock className="size-5" aria-hidden /> ครูยังไม่เปิด
      </span>
    )
  if (item.pct === 100)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-mint-500">
        <CircleCheck className="size-5" aria-hidden /> ครบแล้ว
      </span>
    )
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-action px-3 py-1 text-sm font-semibold text-white shadow-action">
      {item.pct ? 'เรียนต่อ' : 'เริ่ม'} <ArrowRight className="size-4" aria-hidden />
    </span>
  )
}

function Row({ s, item, isNext }: { s: CourseSession; item?: MapItem; isNext: boolean }) {
  const open = !!item?.open
  const unit = course.units.find((u) => u.no === s.unit)
  const Icon = sessionIcon(s)
  const body = (
    <>
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-2xl text-lg font-bold tabular-nums ${
          !open ? 'bg-surface text-slate-400 dark:bg-dq-800' : isNext ? 'bg-action-soft text-action-strong' : 'bg-db-50 text-db-700 dark:bg-db-700/30 dark:text-db-100'
        }`}
      >
        {s.no}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold leading-snug ${open ? 'text-ink dark:text-white' : 'text-slate-500'}`}>{s.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2 dark:text-dq-300">
          <Icon className="size-4 shrink-0" aria-hidden />
          {unit ? `หน่วย ${unit.no} · ${unit.title}` : 'คาบพิเศษ'}
        </span>
        {open && item?.pct != null && item.pct > 0 && item.pct < 100 && <ProgressBar value={item.pct} className="mt-2 h-1.5 max-w-48" />}
      </span>
      <Status item={item} />
    </>
  )
  return open ? (
    <Link to={`/db/lesson/${s.no}`} className="tq-press flex items-center gap-3 px-4 py-3.5 hover:bg-surface/60 sm:px-5 dark:hover:bg-dq-800">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3.5 opacity-75 sm:px-5" aria-disabled="true">
      {body}
    </div>
  )
}

// หน้าบทเรียน 20 คาบ: การ์ดเดียว แถวเรียงต่อกัน สีส้มอยู่ที่คาบที่ควรเรียนต่อเท่านั้น
export function DbqMapPage() {
  const map = useAsync(fetchMap, [])
  const byNo = new Map(map.data?.map((m) => [m.session_no, m]))
  const next = map.data ? nextSession(map.data) : undefined

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.45rem] leading-tight text-ink sm:text-[2.1rem] dark:text-white">บทเรียน</h1>
        <p className="mt-1 text-ink-2 dark:text-dq-300">20 คาบ · 7 หน่วย</p>
      </header>
      {map.status === 'loading' && <LoadingBlock />}
      {map.status === 'error' && <ErrorBlock message={map.error} onRetry={map.reload} />}
      {map.status === 'success' && (
        <ol className="tq-card divide-y divide-line overflow-hidden dark:divide-dq-800 dark:bg-dq-900 dark:ring-dq-800">
          {course.sessions.map((s) => (
            <li key={s.no}>
              <Row s={s} item={byNo.get(s.no)} isNext={next?.session_no === s.no} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
