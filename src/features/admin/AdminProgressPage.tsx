import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Lock, RotateCcw } from 'lucide-react'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { fullName } from '@/features/assignments/gradebookData'
import { formatGrade } from '@/lib/grade'
import { CATEGORY_LABELS, type StudentScore } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import { fetchProgressList, fetchStudentProgress, resetSessionProgress, XP_SOURCE_LABEL, type SessionProgress } from './studentProgress'

const panel = 'rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-5'
const secondaryLink =
  'inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 font-display text-sm text-brand-700 ring-2 ring-brand-100 hover:bg-brand-50'

const dateFmt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const formatDateTime = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '-')
const displayName = (s: Parameters<typeof fullName>[0] & { nickname: string }) => (s.nickname ? `${fullName(s)} (${s.nickname})` : fullName(s))

// ความคืบหน้านักเรียน ม.3 (แบบเดียวกับหน้าครู DB Quest) — แก้รายชื่อ/นำเข้าอยู่ที่ /admin/students
export function AdminProgressPage() {
  const [params, setParams] = useSearchParams()
  const room = params.get('room')
  const res = useAsync(() => fetchProgressList(room), [room])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">ความคืบหน้านักเรียน ม.3</h1>
          {res.data && <p className="text-sm text-slate-500">{res.data.rows.length} คน</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2"
            aria-label="ห้องเรียน"
            value={room ?? ''}
            onChange={(e) => setParams(e.target.value ? { room: e.target.value } : {})}
          >
            <option value="">ทุกห้อง</option>
            {res.data?.rooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Link to="/admin/students" className={secondaryLink}>
            เพิ่ม / นำเข้า / ลบ / รีเซ็ตเครื่อง
          </Link>
        </div>
      </div>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' && (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
          {res.data.rows.length === 0 ? (
            <p className="p-5 text-slate-500">ยังไม่มีนักเรียนในห้องนี้</p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-brand-50 text-slate-600">
                <tr className="[&_th]:px-3 [&_th]:py-2 [&_th]:font-medium">
                  <th>ห้อง</th>
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
                {res.data.rows.map((r) => (
                  <tr key={r.student.id} className={`border-t border-brand-50 [&_td]:px-3 [&_td]:py-2 ${r.student.is_active ? '' : 'opacity-50'}`}>
                    <td>{r.roomName}</td>
                    <td>{r.student.number ?? '-'}</td>
                    <td className="font-mono">{r.student.student_code}</td>
                    <td>
                      <Link to={`/admin/progress/${r.student.id}`} className="text-brand-700 underline-offset-2 hover:underline">
                        {displayName(r.student)}
                      </Link>
                      {!r.student.is_active && <span className="ml-1 text-xs text-slate-500">(ปิดใช้งาน)</span>}
                    </td>
                    <td className="text-right font-display">{r.xp}</td>
                    <td className="text-right">{r.sessionsDone}</td>
                    <td className="text-right">{r.currentSession ?? '-'}</td>
                    <td className="text-right">{r.badges}</td>
                    <td className="text-slate-500">{formatDateTime(r.lastActive)}</td>
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

function ScoreBreakdown({ score }: { score: StudentScore }) {
  return (
    <div className="space-y-2">
      <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {score.categories.map((c) => (
          <li key={c.category} className="rounded-xl bg-brand-50 p-3">
            <p className="text-sm text-slate-500">
              {CATEGORY_LABELS[c.category]} ({c.weight})
            </p>
            <p className="font-display text-lg text-brand-900">{c.gradedMax === 0 && c.category !== 'affective' ? '—' : c.scaled}</p>
            {c.max > 0 && (
              <p className="text-xs text-slate-500">
                {c.raw} / {c.max}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="font-display text-brand-900">
        รวม {score.total} / 100 · เกรด {formatGrade(score.grade)}
        {score.predictedTotal != null && (
          <span className="ml-2 text-sm font-normal text-slate-500">
            (คาดการณ์จากงานที่ตรวจแล้ว {score.predictedTotal} คะแนน
            {score.predictedGrade != null && ` · เกรด ${formatGrade(score.predictedGrade)}`})
          </span>
        )}
      </p>
    </div>
  )
}

export function AdminStudentProgressPage() {
  const id = useParams().studentId ?? ''
  const res = useAsync(() => fetchStudentProgress(id), [id])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  const d = res.data
  const done = d.sessions.filter((s) => s.done >= s.total).length

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/admin/progress${d.student.classroom_id ? `?room=${d.student.classroom_id}` : ''}`} className="text-sm text-brand-700 hover:underline">
        ← ความคืบหน้านักเรียน
      </Link>
      <div>
        <h1 className="text-2xl text-ink">{displayName(d.student)}</h1>
        <p className="text-slate-500">
          {d.room?.name ?? 'ไม่มีห้อง'} · เลขที่ {d.student.number ?? '-'} · รหัส {d.student.student_code} · {d.xp} XP · ครบ {done}/{d.sessions.length} คาบ
        </p>
      </div>

      {d.score && (
        <section className={panel}>
          <h2 className="mb-3 text-lg text-brand-900">คะแนน</h2>
          <ScoreBreakdown score={d.score} />
        </section>
      )}

      <section className={panel}>
        <h2 className="mb-3 text-lg text-brand-900">ความคืบหน้ารายคาบ</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {d.sessions.map((s) => (
            <SessionRow key={s.session_no} s={s} studentId={d.student.id} studentName={displayName(d.student)} onReset={res.reload} />
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={panel}>
          <h2 className="mb-3 text-lg text-brand-900">เกม</h2>
          {d.games.length === 0 ? (
            <p className="text-slate-500">ยังไม่เคยเล่น</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.games.map((g) => (
                <li key={g.gameId} className="flex justify-between gap-2">
                  <span>{g.title}</span>
                  <span>
                    ดีสุด {g.bestScore}/{g.maxScore} · เล่น {g.plays} ครั้ง
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-4 text-lg text-brand-900">เหรียญ</h2>
          {d.badges.length === 0 ? (
            <p className="text-slate-500">ยังไม่มี</p>
          ) : (
            <p className="flex flex-wrap gap-2">
              {d.badges.map((b) => (
                <span key={b.id} className="rounded-full bg-sun-300/40 px-3 py-1 text-sm">
                  {b.icon} {b.name}
                </span>
              ))}
            </p>
          )}
        </section>
        <section className={panel}>
          <h2 className="mb-3 text-lg text-brand-900">XP ล่าสุด</h2>
          {d.recentXp.length === 0 ? (
            <p className="text-slate-500">ยังไม่มี</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.recentXp.map((x) => (
                <li key={x.id} className="grid grid-cols-[1fr_3rem_auto] items-baseline gap-2">
                  <span className="text-slate-700">{XP_SOURCE_LABEL[x.source]}</span>
                  <span className="text-right font-display text-brand-700">+{x.xp}</span>
                  <span className="text-slate-400">{formatDateTime(x.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// แถวคาบในหน้ารายคน + ปุ่มรีเซ็ตขั้นที่ทำเสร็จของคาบนั้น (ยืนยันในแถว)
function SessionRow({ s, studentId, studentName, onReset }: { s: SessionProgress; studentId: string; studentName: string; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pct = Math.round((s.done / s.total) * 100)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await resetSessionProgress(studentId, s.session_no)
      setConfirming(false)
      onReset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'รีเซ็ตไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`rounded-xl px-3 py-2 text-sm ${confirming ? 'bg-amber-50 ring-1 ring-amber-200 sm:col-span-2' : 'bg-brand-50'}`}>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-display text-brand-700">คาบ {s.session_no}</span>
        <span className="min-w-0 flex-1 truncate">{s.title}</span>
        <span className={`shrink-0 font-display ${pct === 100 ? 'text-emerald-700' : s.open ? 'text-brand-700' : 'text-slate-400'}`}>
          {!s.open && s.done === 0 ? <Lock className="size-4" aria-label="ยังล็อก" /> : `${pct}%`}
        </span>
        {s.done > 0 && !confirming && (
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
            รีเซ็ตคาบ {s.session_no} ของ {studentName}? ขั้นที่ทำเสร็จ งานที่ส่ง คะแนนที่ตรวจแล้ว ผลสอบ/Exit ticket ผลเกม และ XP ของคาบนี้จะหายทั้งหมด นักเรียนต้องทำคาบนี้ใหม่ (เหรียญยังอยู่)
          </p>
          <Button variant="secondary" className="min-h-10" disabled={busy} onClick={() => setConfirming(false)}>
            ยกเลิก
          </Button>
          <Button className="min-h-10 bg-rose-600 shadow-none hover:bg-rose-700" loading={busy} loadingText="กำลังรีเซ็ต…" onClick={() => void run()}>
            รีเซ็ตคาบนี้
          </Button>
          {error && <p className="w-full text-rose-700">{error}</p>}
        </div>
      )}
    </li>
  )
}
