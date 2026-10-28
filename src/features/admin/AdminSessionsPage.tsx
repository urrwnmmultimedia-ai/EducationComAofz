import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { fetchAdminSessions, setSessionUnlock, swapSessions } from './adminLessonsApi'

const ALL = '__all__'

export function AdminSessionsPage() {
  const state = useAsync(fetchAdminSessions, [])
  const [roomId, setRoomId] = useState<string>(ALL)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { sessions, classrooms, unlocks, units } = state.data
  const unitNo = new Map(units.map((u) => [u.id, u.no]))

  const isUnlocked = (sessionNo: number, classroomId: string) =>
    unlocks.some((u) => u.session_no === sessionNo && u.classroom_id === classroomId && u.is_unlocked)

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await fn()
      state.reload()
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(null)
    }
  }

  const rooms = roomId === ALL ? classrooms : classrooms.filter((c) => c.id === roomId)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">บทเรียน / คาบเรียน</h1>
          <p className="text-sm text-slate-500">ปลดล็อกคาบให้แต่ละห้อง สลับลำดับ และแก้ไขเนื้อหา</p>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          ห้องเรียน
          <select
            className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            <option value={ALL}>ทุกห้อง</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}
      {classrooms.length === 0 && (
        <EmptyBlock>
          ยังไม่มีห้องเรียน — <Link to="/admin/classrooms" className="underline">เพิ่มห้องเรียน</Link>
        </EmptyBlock>
      )}

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-brand-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">คาบ</th>
              <th className="px-3 py-2 font-medium">หน่วย</th>
              <th className="px-3 py-2 font-medium">เรื่อง</th>
              {rooms.map((r) => (
                <th key={r.id} className="px-3 py-2 text-center font-medium">
                  {r.name}
                </th>
              ))}
              {roomId === ALL && classrooms.length > 1 && <th className="px-3 py-2 text-center font-medium">ทุกห้อง</th>}
              <th className="px-3 py-2 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => {
              const prev = sessions[i - 1]
              const next = sessions[i + 1]
              const allOpen = classrooms.length > 0 && classrooms.every((c) => isUnlocked(s.session_no, c.id))
              return (
                <tr key={s.id} className="border-t border-brand-50">
                  <td className="px-3 py-2 font-display text-brand-700">{s.session_no}</td>
                  <td className="px-3 py-2">{s.unit_id ? unitNo.get(s.unit_id) : '–'}</td>
                  <td className="max-w-xs px-3 py-2">
                    <span className="line-clamp-2">{s.title}</span>
                  </td>
                  {rooms.map((r) => {
                    const open = isUnlocked(s.session_no, r.id)
                    const key = `${s.session_no}:${r.id}`
                    return (
                      <td key={r.id} className="px-3 py-2 text-center">
                        <UnlockToggle
                          open={open}
                          loading={busy === key}
                          disabled={busy !== null}
                          onToggle={() => void run(key, () => setSessionUnlock(s.session_no, !open, r.id))}
                        />
                      </td>
                    )
                  })}
                  {roomId === ALL && classrooms.length > 1 && (
                    <td className="px-3 py-2 text-center">
                      <UnlockToggle
                        open={allOpen}
                        loading={busy === `${s.session_no}:all`}
                        disabled={busy !== null}
                        onToggle={() => void run(`${s.session_no}:all`, () => setSessionUnlock(s.session_no, !allOpen, null))}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <IconButton
                        label="เลื่อนขึ้น"
                        disabled={!prev || busy !== null}
                        onClick={() => prev && void run(`swap:${s.session_no}`, () => swapSessions(prev.session_no, s.session_no))}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="เลื่อนลง"
                        disabled={!next || busy !== null}
                        onClick={() => next && void run(`swap:${s.session_no}`, () => swapSessions(s.session_no, next.session_no))}
                      >
                        ↓
                      </IconButton>
                      <Link
                        to={`/admin/sessions/${s.session_no}`}
                        className="rounded-lg px-2 py-1 font-display text-brand-700 hover:bg-brand-100"
                      >
                        แก้ไข
                      </Link>
                      <Link to={`/sessions/${s.session_no}`} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-brand-100">
                        ดูตัวอย่าง
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        นักเรียนที่เปิดหน้าคาบซึ่ง "ปลดล็อกล่าสุด" ภายใน 12 ชั่วโมง จะถูกเช็คชื่อมาเรียนอัตโนมัติ (+10 XP)
      </p>
    </div>
  )
}

function UnlockToggle({ open, loading, disabled, onToggle }: { open: boolean; loading: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={open ? 'primary' : 'secondary'}
      className="min-h-8 min-w-24 px-2 py-1 text-sm"
      loading={loading}
      loadingText="…"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={open}
    >
      {open ? '🔓 เปิดอยู่' : '🔒 ปิด'}
    </Button>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-slate-600 hover:bg-brand-100 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
