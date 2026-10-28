import { Link, useParams, useSearchParams } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { btn, displayName, formatDateTime, PageHeader, panel, RoomSelect } from './adminUi'
import { CATEGORIES, CATEGORY_LABEL, fetchStudentDetail, fetchStudents, type Scores } from './dbqAdminApi'
import { gradeOf } from './gradebookModel'
import { xpLabel } from './xpLabel'

export function DbqAdminStudents() {
  const [params, setParams] = useSearchParams()
  const room = params.get('room')
  const res = useAsync(() => fetchStudents(room), [room])

  return (
    <div className="space-y-4">
      <PageHeader title="นักเรียน DB Quest">
        <RoomSelect value={room} onChange={(id) => setParams(id ? { room: id } : {})} />
        <Link to="/admin/students" className={btn.secondary}>
          เพิ่ม / นำเข้า / รีเซ็ตเครื่อง
        </Link>
      </PageHeader>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' && (
        <div className={`${panel} overflow-x-auto`}>
          {res.data.length === 0 ? (
            <p className="text-slate-500">ยังไม่มีนักเรียนในห้องนี้</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm [&_td]:px-2 [&_th]:px-2">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2">ห้อง</th>
                  <th>เลขที่</th>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th className="text-right">XP</th>
                  <th className="text-right">คาบที่ครบ</th>
                  <th className="text-right">คาบล่าสุด</th>
                  <th className="text-right">เหรียญ</th>
                  <th>ใช้งานล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {res.data.map((s) => (
                  <tr key={s.id} className={`border-t border-dq-50 ${s.is_active ? '' : 'opacity-50'}`}>
                    <td className="py-2">{s.classroom_name}</td>
                    <td>{s.number ?? '-'}</td>
                    <td className="font-mono">{s.student_code}</td>
                    <td>
                      <Link to={`/db/admin/students/${s.id}`} className="text-dq-700 underline-offset-2 hover:underline">
                        {displayName(s)}
                      </Link>
                      {!s.is_active && <span className="ml-1 text-xs text-slate-500">(ปิดใช้งาน)</span>}
                    </td>
                    <td className="text-right font-display">{s.xp}</td>
                    <td className="text-right">{s.sessions_done}</td>
                    <td className="text-right">{s.current_session ?? '-'}</td>
                    <td className="text-right">{s.badges}</td>
                    <td className="text-slate-500">{formatDateTime(s.last_active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export function ScoreBreakdown({ scores }: { scores: Scores }) {
  return (
    <div className="space-y-2">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((c) => {
          const s = scores.categories[c]
          return (
            <li key={c} className="rounded-xl bg-dq-50 p-3">
              <p className="text-sm text-slate-500">
                {CATEGORY_LABEL[c]} ({s?.weight ?? 0})
              </p>
              <p className="font-display text-lg text-dq-900">{s?.points == null ? '—' : s.points}</p>
              {s?.max != null && (
                <p className="text-xs text-slate-500">
                  {s.earned} / {s.max}
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <p className="font-display text-dq-900">
        รวม {scores.total} / 100 · เกรด {gradeOf(scores)}
        {scores.current_pct != null && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            (คิดเฉพาะหมวดที่มีคะแนนแล้ว {scores.available} คะแนน = {scores.current_pct}%)
          </span>
        )}
      </p>
    </div>
  )
}

export function DbqAdminStudentDetail() {
  const id = useParams().studentId ?? ''
  const res = useAsync(() => fetchStudentDetail(id), [id])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  const d = res.data

  return (
    <div className="space-y-4">
      <Link to={`/db/admin/students${d.student.classroom_id ? `?room=${d.student.classroom_id}` : ''}`} className="text-sm text-dq-700 hover:underline">
        ← รายชื่อนักเรียน
      </Link>
      <PageHeader title={displayName(d.student)}>
        <span className="text-slate-500">
          {d.student.classroom_name} · เลขที่ {d.student.number ?? '-'} · รหัส {d.student.student_code} · {d.xp} XP
        </span>
      </PageHeader>

      <section className={panel}>
        <h2 className="mb-3 text-lg text-dq-900">คะแนน</h2>
        <ScoreBreakdown scores={d.scores} />
      </section>

      <section className={panel}>
        <h2 className="mb-3 text-lg text-dq-900">ความคืบหน้ารายคาบ</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {d.sessions.map((s) => (
            <li key={s.session_no} className="flex items-center gap-2 rounded-xl bg-dq-50 px-3 py-2 text-sm">
              <span className="w-14 font-display text-dq-700">คาบ {s.session_no}</span>
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className={`shrink-0 font-display ${s.pct === 100 ? 'text-emerald-700' : s.open ? 'text-dq-700' : 'text-slate-400'}`}>
                {!s.open ? '🔒' : s.pct == null ? '—' : `${s.pct}%`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={panel}>
          <h2 className="mb-3 text-lg text-dq-900">เกม</h2>
          {d.games.length === 0 ? (
            <p className="text-slate-500">ยังไม่เคยเล่น</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.games.map((g) => (
                <li key={g.game_key} className="flex justify-between gap-2">
                  <span className="font-mono">{g.game_key}</span>
                  <span>
                    ดีสุด {g.best_score} · {'⭐'.repeat(g.best_stars)} · เล่น {g.plays} ครั้ง
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-4 text-lg text-dq-900">เหรียญ</h2>
          {d.badges.length === 0 ? (
            <p className="text-slate-500">ยังไม่มี</p>
          ) : (
            <p className="flex flex-wrap gap-2">
              {d.badges.map((b) => (
                <span key={b.key} className="rounded-full bg-xp-300/40 px-3 py-1 text-sm">
                  {b.icon} {b.name}
                </span>
              ))}
            </p>
          )}
        </section>
        <section className={panel}>
          <h2 className="mb-3 text-lg text-dq-900">XP ล่าสุด</h2>
          <ul className="space-y-1 text-sm">
            {d.recent_xp.map((x, i) => (
              <li key={i} className="grid grid-cols-[1fr_3rem_auto] items-baseline gap-2">
                <span className="text-slate-700" title={x.source}>
                  {xpLabel(x.source)}
                </span>
                <span className="text-right font-display text-xp-600">+{x.amount}</span>
                <span className="text-slate-400">{formatDateTime(x.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
