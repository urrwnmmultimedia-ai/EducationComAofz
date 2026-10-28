import type { ReactNode } from 'react'
import { useAsync } from '@/lib/useAsync'
import { fetchUnlocks } from './dbqAdminApi'

// ชิ้นส่วนหน้าครู DB Quest (ธีมสว่าง สีน้ำเงิน)

export const btn = {
  primary: 'inline-flex min-h-10 items-center justify-center rounded-xl bg-dq-600 px-4 font-display text-sm text-white hover:bg-dq-700 disabled:opacity-50',
  secondary: 'inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 font-display text-sm text-dq-700 ring-2 ring-dq-100 hover:bg-dq-50 disabled:opacity-50',
  danger: 'inline-flex min-h-10 items-center justify-center rounded-xl px-4 font-display text-sm text-rose-700 ring-2 ring-rose-100 hover:bg-rose-50 disabled:opacity-50',
}
export const panel = 'rounded-2xl bg-white p-4 ring-1 ring-dq-100'
export const input = 'min-h-10 rounded-xl border-2 border-dq-100 bg-white px-3 outline-none focus:border-dq-500'

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-2xl text-dq-900">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

// ห้อง DB Quest (ใช้ร่วมกันหลายหน้า)
export function useRooms() {
  return useAsync(fetchUnlocks, [])
}

export function RoomSelect({ value, onChange, allowAll = true }: { value: string | null; onChange: (id: string | null) => void; allowAll?: boolean }) {
  const rooms = useRooms()
  return (
    <select className={input} aria-label="เลือกห้อง" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowAll && <option value="">ทุกห้อง</option>}
      {rooms.data?.map((r) => (
        <option key={r.classroom_id} value={r.classroom_id}>
          {r.name} ({r.students} คน)
        </option>
      ))}
    </select>
  )
}

export function Stat({ label, value, tone = 'dq' }: { label: string; value: ReactNode; tone?: 'dq' | 'xp' | 'rose' }) {
  const color = tone === 'xp' ? 'text-xp-600' : tone === 'rose' ? 'text-rose-600' : 'text-dq-700'
  return (
    <div className={panel}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`font-display text-3xl ${color}`}>{value}</p>
    </div>
  )
}

const dateFmt = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '-'
}

export function displayName(s: { name: string; nickname: string }): string {
  return s.nickname ? `${s.name} (${s.nickname})` : s.name
}
