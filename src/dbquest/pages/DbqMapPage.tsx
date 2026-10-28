import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { course, type CourseSession } from '@/content/course'
import { useAsync } from '@/lib/useAsync'
import { fetchMap, type MapItem } from '../lesson/dbqLessonApi'

const KIND_ICON: Record<CourseSession['kind'], string> = {
  lesson: '',
  midterm: '📝',
  project: '🏗️',
  final: '🏁',
}

const card = 'flex min-h-16 items-center gap-3 rounded-3xl bg-white p-3 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800'

function Status({ item }: { item?: MapItem }) {
  if (!item) return null
  if (!item.open) return <span className="ml-auto shrink-0 text-xl" aria-label="ยังล็อก">🔒</span>
  if (item.pct === null) return null
  return (
    <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 font-display text-base ${item.pct === 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-dq-100 text-dq-800 dark:bg-dq-800 dark:text-dq-100'}`}>
      {item.pct === 100 ? '✓ ครบ' : `${item.pct}%`}
    </span>
  )
}

// แผนที่การเรียน 20 คาบ: สถานะเปิด/ล็อก และ % ความคืบหน้ามาจากเซิร์ฟเวอร์
export function DbqMapPage() {
  const map = useAsync(fetchMap, [])
  const byNo = new Map(map.data?.map((m) => [m.session_no, m]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl text-dq-900 dark:text-white">แผนที่การเรียน</h1>
        <p className="text-slate-600 dark:text-dq-300">20 คาบ · คาบละ 2 ชั่วโมง · รวม 40 ชั่วโมง</p>
      </header>
      {map.status === 'loading' && <LoadingBlock />}
      {map.status === 'error' && <ErrorBlock message={map.error} onRetry={map.reload} />}
      {map.status === 'success' && (
        <ol className="grid gap-3 sm:grid-cols-2">
          {course.sessions.map((s) => {
            const unit = course.units.find((u) => u.no === s.unit)
            const item = byNo.get(s.no)
            const body = (
              <>
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl font-display text-xl text-white ${item?.open ? 'bg-dq-600' : 'bg-slate-400 dark:bg-slate-600'}`}>
                  {s.no}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-slate-500 dark:text-dq-300">
                    {unit ? `${unit.icon} หน่วย ${unit.no}` : `${KIND_ICON[s.kind]} คาบพิเศษ`}
                  </span>
                  <span className="block font-display text-dq-900 dark:text-white">{s.title}</span>
                </span>
                <Status item={item} />
              </>
            )
            return (
              <li key={s.no}>
                {item?.open ? (
                  <Link to={`/db/lesson/${s.no}`} className={`${card} transition hover:ring-dq-300 dark:hover:ring-dq-600`}>
                    {body}
                  </Link>
                ) : (
                  <div className={`${card} opacity-70`} aria-disabled="true">
                    {body}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
