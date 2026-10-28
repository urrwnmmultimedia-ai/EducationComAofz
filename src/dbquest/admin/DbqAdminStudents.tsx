import { Link, useParams, useSearchParams } from 'react-router'
import { useState } from 'react'
import { Lock, RotateCcw } from 'lucide-react'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { btn, displayName, formatDateTime, PageHeader, panel, RoomSelect } from './adminUi'
import { CATEGORIES, CATEGORY_LABEL, fetchStudentDetail, fetchStudents, resetSession, type Scores, type StudentDetail } from './dbqAdminApi'
import { gradeOf } from './gradebookModel'
import { xpLabel } from './xpLabel'
import { evolutionOf } from '../evolution'
import { fetchGameTitles, gameTitle } from '../gameTitles'

export function DbqAdminStudents() {
  const [params, setParams] = useSearchParams()
  const room = params.get('room')
  const res = useAsync(() => fetchStudents(room), [room])

  return (
    <div className="space-y-4">
      <PageHeader title="ความคืบหน้านักเรียน">
        <RoomSelect value={room} onChange={(id) => setParams(id ? { room: id } : {})} />
        <Link to="/db/admin/roster" className={btn.secondary}>
          เพิ่ม / นำเข้า / ลบ / รีเซ็ตเครื่อง
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
  const res = useAsync(() => Promise.all([fetchStudentDetail(id), fetchGameTitles()]), [id])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  const [d, titles] = res.data
  const evo = evolutionOf(d.xp, d.sessions.filter((s) => s.kind === 'lesson' && s.pct === 100).length)

  return (
    <div className="space-y-4">
      <Link to={`/db/admin/students${d.student.classroom_id ? `?room=${d.student.classroom_id}` : ''}`} className="text-sm text-dq-700 hover:underline">
        ← ความคืบหน้านักเรียน
      </Link>
      <PageHeader title={displayName(d.student)}>
        <span className="text-slate-500">
          {d.student.classroom_name} · เลขที่ {d.student.number ?? '-'} · รหัส {d.student.student_code} · {d.xp} XP · วิวัฒนาการขั้น {evo.index + 1} {evo.stage.name}
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
            <SessionRow key={s.session_no} s={s} studentId={d.student.id} studentName={displayName(d.student)} onReset={res.reload} />
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
                  <span>{gameTitle(titles, g.game_key)}</span>
                  <span>
                    ดีสุด {g.best_score} · {g.best_stars} ดาว · เล่น {g.plays} ครั้ง
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
                  {xpLabel(x.source, titles)}
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

// แถวคาบในหน้ารายคน + ปุ่มรีเซ็ตบทเรียนของคาบนั้น (ยืนยันในแถว)
function SessionRow({
  s,
  studentId,
  studentName,
  onReset,
}: {
  s: StudentDetail['sessions'][number]
  studentId: string
  studentName: string
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = s.steps_done.length > 0

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await resetSession(studentId, s.session_no)
      setConfirming(false)
      onReset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'รีเซ็ตไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`rounded-xl px-3 py-2 text-sm ${confirming ? 'bg-amber-50 ring-1 ring-amber-200 sm:col-span-2' : 'bg-dq-50'}`}>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-display text-dq-700">คาบ {s.session_no}</span>
        <span className="min-w-0 flex-1 truncate">{s.title}</span>
        <span className={`shrink-0 font-display ${s.pct === 100 ? 'text-emerald-700' : s.open ? 'text-dq-700' : 'text-slate-400'}`}>
          {!s.open ? <Lock className="size-4" aria-label="ยังล็อก" /> : s.pct == null ? '—' : `${s.pct}%`}
        </span>
        {started && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-2 hover:bg-white hover:text-ink"
            aria-label={`รีเซ็ตคาบ ${s.session_no} ของ ${studentName}`}
          >
            <RotateCcw className="size-3.5" aria-hidden /> รีเซ็ต
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-amber-950">
            รีเซ็ตคาบ {s.session_no} ของ {studentName}? ความคืบหน้าทุกขั้น คำตอบ และ XP ของคาบนี้จะหาย ส่วนใบงานที่ส่ง คะแนนเกม และเหรียญยังอยู่
            ถ้าคาบถัดไปเปิดเพราะทำคาบนี้ครบตามเกณฑ์ จะถูกล็อกกลับจนกว่าจะทำใหม่
          </p>
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => setConfirming(false)}>
            ยกเลิก
          </button>
          <button type="button" className={btn.danger} disabled={busy} onClick={() => void run()}>
            {busy ? 'กำลังรีเซ็ต…' : 'รีเซ็ตคาบนี้'}
          </button>
          {error && <p className="w-full text-rose-700">{error}</p>}
        </div>
      )}
    </li>
  )
}
