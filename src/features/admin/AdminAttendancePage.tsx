import { useState } from 'react'
import { ErrorBlock, EmptyBlock, LoadingBlock } from '@/components/StatusViews'
import type { AttendanceRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { fullName } from '@/features/assignments/gradebookData'

type Status = AttendanceRow['status']
const STATUS: { value: Status; label: string; cls: string }[] = [
  { value: 'present', label: 'มา', cls: 'bg-emerald-100 text-emerald-800 ring-emerald-300' },
  { value: 'late', label: 'สาย', cls: 'bg-amber-100 text-amber-800 ring-amber-300' },
  { value: 'leave', label: 'ลา', cls: 'bg-sky-100 text-sky-800 ring-sky-300' },
  { value: 'absent', label: 'ขาด', cls: 'bg-rose-100 text-rose-800 ring-rose-300' },
]

async function fetchData() {
  const [c, s, cs, a] = await Promise.all([
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
    supabase.from('students').select('*').eq('is_active', true).order('number'),
    supabase.from('class_sessions').select('session_no, title').order('session_no'),
    supabase.from('attendance').select('*'),
  ])
  for (const r of [c, s, cs, a]) if (r.error) throw r.error
  return { classrooms: c.data ?? [], students: s.data ?? [], sessions: cs.data ?? [], attendance: a.data ?? [] }
}

// เช็คชื่อ: ระบบบันทึก "มา" อัตโนมัติเมื่อนักเรียนเปิดหน้าคาบ — ครูแก้/เพิ่มได้ที่นี่
export function AdminAttendancePage() {
  const state = useAsync(fetchData, [])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [sessionNo, setSessionNo] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Status | 'none'>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { classrooms, students, sessions, attendance } = state.data
  const room = roomId ?? classrooms[0]?.id ?? ''
  const sNo = sessionNo ?? sessions[0]?.session_no ?? 1
  const list = students.filter((s) => s.classroom_id === room)
  const current = (sid: string): Status | 'none' =>
    overrides[`${sid}:${sNo}`] ?? attendance.find((a) => a.student_id === sid && a.session_no === sNo)?.status ?? 'none'

  const setStatus = async (sid: string, status: Status) => {
    const key = `${sid}:${sNo}`
    if (busy) return
    setBusy(key)
    setError(null)
    const { error: err } = await supabase
      .from('attendance')
      .upsert({ student_id: sid, session_no: sNo, classroom_id: room, status, checked_at: new Date().toISOString() }, { onConflict: 'student_id,session_no' })
    setBusy(null)
    if (err) setError('บันทึกไม่สำเร็จ')
    else setOverrides((o) => ({ ...o, [key]: status }))
  }

  const counts = STATUS.map((st) => ({ ...st, n: list.filter((s) => current(s.id) === st.value).length }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">เช็คชื่อ</h1>
          <p className="text-sm text-slate-500">ระบบบันทึก "มา" ให้อัตโนมัติเมื่อนักเรียนเปิดหน้าคาบที่ครูเพิ่งเปิด · แก้ไขหรือเพิ่มได้ที่นี่</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2" value={room} onChange={(e) => setRoomId(e.target.value)} aria-label="ห้องเรียน">
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="max-w-64 rounded-xl border-2 border-brand-100 bg-white px-3 py-2" value={sNo} onChange={(e) => setSessionNo(Number(e.target.value))} aria-label="คาบ">
            {sessions.map((s) => (
              <option key={s.session_no} value={s.session_no}>
                คาบ {s.session_no} {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="flex flex-wrap gap-2 text-sm">
        {counts.map((c) => (
          <span key={c.value} className={`rounded-full px-3 py-0.5 ring-1 ${c.cls}`}>
            {c.label} {c.n}
          </span>
        ))}
        <span className="rounded-full bg-slate-100 px-3 py-0.5 text-slate-600">ยังไม่บันทึก {list.filter((s) => current(s.id) === 'none').length}</span>
        {error && <span className="text-rose-600">{error}</span>}
      </p>

      {list.length === 0 ? (
        <EmptyBlock>ห้องนี้ยังไม่มีนักเรียน</EmptyBlock>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((s) => {
            const cur = current(s.id)
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-brand-100">
                <span className="min-w-0 flex-1">
                  <span className="text-slate-400">{s.number ?? '-'}.</span> {fullName(s)} {s.nickname && <span className="text-slate-500">({s.nickname})</span>}
                </span>
                <div className="flex gap-1" role="radiogroup" aria-label={`สถานะของ ${s.first_name}`}>
                  {STATUS.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      role="radio"
                      aria-checked={cur === st.value}
                      disabled={busy !== null}
                      onClick={() => void setStatus(s.id, st.value)}
                      className={`min-w-12 rounded-xl px-3 py-1.5 font-display text-sm ring-1 transition disabled:opacity-60 ${cur === st.value ? st.cls : 'bg-white text-slate-500 ring-brand-100 hover:bg-brand-50'}`}
                    >
                      {busy === `${s.id}:${sNo}` && cur !== st.value ? '…' : st.label}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
