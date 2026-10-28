import { Link } from 'react-router'
import { course, type CourseSession } from '@/content/course'

const KIND_ICON: Record<CourseSession['kind'], string> = {
  lesson: '',
  midterm: '📝',
  project: '🏗️',
  final: '🏁',
}

// แผนที่การเรียน 20 คาบ (เฟส 1: โครงอย่างเดียว สถานะล็อก/ผ่านมาในเฟส 3)
export function DbqMapPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl text-dq-900 dark:text-white">แผนที่การเรียน</h1>
        <p className="text-slate-600 dark:text-dq-300">20 คาบ · คาบละ 2 ชั่วโมง · รวม 40 ชั่วโมง</p>
      </header>
      <ol className="grid gap-3 sm:grid-cols-2">
        {course.sessions.map((s) => {
          const unit = course.units.find((u) => u.no === s.unit)
          return (
            <li key={s.no}>
              <Link
                to={`/db/lesson/${s.no}`}
                className="flex min-h-16 items-center gap-3 rounded-3xl bg-white p-3 ring-1 ring-dq-100 transition hover:ring-dq-300 dark:bg-dq-900 dark:ring-dq-800 dark:hover:ring-dq-600"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-dq-600 font-display text-xl text-white">
                  {s.no}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-slate-500 dark:text-dq-300">
                    {unit ? `${unit.icon} หน่วย ${unit.no}` : `${KIND_ICON[s.kind]} คาบพิเศษ`}
                  </span>
                  <span className="block font-display text-dq-900 dark:text-white">{s.title}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
