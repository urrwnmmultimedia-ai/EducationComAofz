import { useState } from 'react'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { course } from '@/content/course'
import { btn, PageHeader, panel, useRooms } from './adminUi'
import { setUnlock } from './dbqAdminApi'

// ปลดล็อกคาบให้ห้อง (นอกเหนือจากการปลดล็อกอัตโนมัติเมื่อทำคาบก่อนหน้าครบตามเกณฑ์)
export function DbqAdminUnlock() {
  const rooms = useRooms()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async (key: string, session: number, on: boolean, roomId: string | null) => {
    setBusy(key)
    setError(null)
    try {
      await setUnlock(session, on, roomId)
      rooms.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  if (rooms.status === 'loading') return <LoadingBlock />
  if (rooms.status === 'error') return <ErrorBlock message={rooms.error} onRetry={rooms.reload} />

  return (
    <div className="space-y-4">
      <PageHeader title="ปลดล็อกคาบ" />
      <p className="text-slate-600">
        คาบ 1 เปิดเสมอ คาบถัดไปเปิดเองเมื่อนักเรียนทำคาบก่อนหน้าครบตามเกณฑ์ (ตั้งได้ที่หน้าตั้งค่า) กดเปิดตรงนี้เพื่อเปิดให้ทั้งห้องทันที
      </p>
      {error && <p className="text-rose-600">{error}</p>}
      {rooms.data.length === 0 && <p className={`${panel} text-slate-500`}>ยังไม่มีห้อง DB Quest</p>}
      {rooms.data.map((r) => (
        <section key={r.classroom_id} className={panel}>
          <h2 className="mb-3 text-lg text-dq-900">
            {r.name} <span className="text-sm text-slate-500">({r.students} คน)</span>
          </h2>
          <ul className="flex flex-wrap gap-2">
            {course.sessions.map((s) => {
              const on = s.no === 1 || r.unlocked.includes(s.no)
              const key = `${r.classroom_id}:${s.no}`
              return (
                <li key={s.no}>
                  <button
                    type="button"
                    disabled={s.no === 1 || busy !== null}
                    aria-pressed={on}
                    title={s.title}
                    onClick={() => void toggle(key, s.no, !on, r.classroom_id)}
                    className={`min-h-10 min-w-12 rounded-xl px-3 font-display text-sm ring-2 transition disabled:cursor-default ${
                      on ? 'bg-dq-600 text-white ring-dq-600' : 'bg-white text-slate-500 ring-dq-100 hover:ring-dq-300'
                    } ${busy === key ? 'opacity-50' : ''}`}
                  >
                    {on ? '🔓' : '🔒'} {s.no}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {rooms.data.length > 1 && (
        <section className={panel}>
          <h2 className="mb-3 text-lg text-dq-900">ทุกห้องพร้อมกัน</h2>
          <ul className="flex flex-wrap gap-2">
            {course.sessions.slice(1).map((s) => (
              <li key={s.no} className="flex items-center gap-1 rounded-xl bg-dq-50 px-2 py-1 text-sm">
                <span className="font-display">คาบ {s.no}</span>
                <button type="button" className={btn.secondary} disabled={busy !== null} onClick={() => void toggle(`all:${s.no}`, s.no, true, null)}>
                  เปิด
                </button>
                <button type="button" className={btn.danger} disabled={busy !== null} onClick={() => void toggle(`all:${s.no}`, s.no, false, null)}>
                  ปิด
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
