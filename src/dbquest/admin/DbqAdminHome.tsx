import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { btn, PageHeader, panel, Stat } from './adminUi'
import { fetchOverview } from './dbqAdminApi'

// ภาพรวม: ห้อง / งานรอตรวจ / ความคืบหน้ารายคาบ
export function DbqAdminHome() {
  const res = useAsync(fetchOverview, [])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  const o = res.data
  const students = o.classrooms.reduce((s, c) => s + c.students, 0)
  const active = o.classrooms.reduce((s, c) => s + c.active_7d, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="ภาพรวม DB Quest">
        <button type="button" className={btn.secondary} onClick={res.reload}>
          รีเฟรช
        </button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="นักเรียนทั้งหมด" value={students} />
        <Stat label="เข้าเรียนใน 7 วันล่าสุด" value={active} />
        <Stat label="งานรอตรวจ" value={o.pending_grading} tone={o.pending_grading > 0 ? 'rose' : 'dq'} />
      </div>
      {o.pending_grading > 0 && (
        <Link to="/db/admin/grading" className={btn.primary}>
          ไปตรวจงาน ({o.pending_grading})
        </Link>
      )}

      <section className={panel}>
        <h2 className="mb-3 text-lg text-dq-900">รายห้อง</h2>
        {o.classrooms.length === 0 ? (
          <p className="text-slate-500">ยังไม่มีห้อง DB Quest — เพิ่มห้องที่เมนู "ห้องเรียน"</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2">ห้อง</th>
                  <th>นักเรียน</th>
                  <th>เข้าเรียน 7 วัน</th>
                  <th>XP เฉลี่ย</th>
                  <th>รอตรวจ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {o.classrooms.map((c) => (
                  <tr key={c.id} className="border-t border-dq-50">
                    <td className="py-2 font-display">{c.name}</td>
                    <td>{c.students}</td>
                    <td>{c.active_7d}</td>
                    <td>{c.avg_xp}</td>
                    <td className={c.pending_grading > 0 ? 'font-display text-rose-600' : ''}>{c.pending_grading}</td>
                    <td className="text-right">
                      <Link to={`/db/admin/students?room=${c.id}`} className="text-dq-700 underline-offset-2 hover:underline">
                        ดูรายชื่อ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panel}>
        <h2 className="mb-3 text-lg text-dq-900">ความคืบหน้ารายคาบ</h2>
        <ol className="space-y-2">
          {o.sessions.map((s) => {
            const pct = students > 0 ? Math.round((100 * s.completed) / students) : 0
            return (
              <li key={s.session_no} className="grid grid-cols-[3rem_1fr] items-center gap-2 text-sm sm:grid-cols-[3rem_1fr_14rem]">
                <span className="font-display text-dq-700">คาบ {s.session_no}</span>
                <span className="truncate">{s.title}</span>
                <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-dq-100" aria-hidden>
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-28 text-right text-slate-500">
                    {s.kind === 'lesson' ? `ครบ ${s.completed} · เริ่ม ${s.started}` : 'คาบพิเศษ'}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
