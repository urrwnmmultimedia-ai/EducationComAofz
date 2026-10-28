import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { ClassroomRow } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { fetchClassrooms, upsertClassroom } from './adminLessonsApi'

const nameSchema = z.string().trim().min(1, 'กรุณากรอกชื่อห้อง').max(30, 'ชื่อห้องยาวเกินไป')
const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'

export function AdminClassroomsPage() {
  const state = useAsync(fetchClassrooms, [])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl text-brand-900">ห้องเรียน</h1>
        <p className="text-sm text-slate-500">เพิ่ม/แก้ชื่อห้อง แล้วไปเปิด-ปิดคาบรายห้องที่หน้า "บทเรียน / คาบเรียน"</p>
      </div>
      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorBlock message={state.error} onRetry={state.reload} />}
      {state.status === 'success' && (
        <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
          {state.data.map((room) => (
            <RoomForm key={room.id} room={room} onSaved={state.reload} />
          ))}
          <RoomForm room={null} nextOrder={state.data.length + 1} onSaved={state.reload} />
        </section>
      )}
    </div>
  )
}

function RoomForm({ room, nextOrder = 0, onSaved }: { room: ClassroomRow | null; nextOrder?: number; onSaved: () => void }) {
  const [name, setName] = useState(room?.name ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'saving') return
    const parsed = nameSchema.safeParse(name)
    if (!parsed.success) {
      setStatus('error')
      setMessage(parsed.error.issues[0]?.message ?? 'ชื่อห้องไม่ถูกต้อง')
      return
    }
    setStatus('saving')
    try {
      await upsertClassroom({ id: room?.id, name: parsed.data, sort_order: room?.sort_order ?? nextOrder })
      setStatus('saved')
      setMessage(null)
      if (!room) setName('')
      onSaved()
    } catch {
      setStatus('error')
      setMessage('บันทึกไม่สำเร็จ (ชื่อห้องอาจซ้ำ)')
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        className={`${INPUT} max-w-xs`}
        aria-label={room ? `ชื่อห้อง ${room.name}` : 'ชื่อห้องใหม่'}
        placeholder={room ? '' : 'เช่น ม.3/2'}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setStatus('idle')
        }}
      />
      <Button type="submit" variant={room ? 'secondary' : 'primary'} loading={status === 'saving'}>
        {room ? 'บันทึก' : '+ เพิ่มห้อง'}
      </Button>
      {status === 'saved' && room && <span className="text-mint-500">บันทึกแล้ว ✓</span>}
      {message && <span className="text-sm text-rose-600">{message}</span>}
    </form>
  )
}
