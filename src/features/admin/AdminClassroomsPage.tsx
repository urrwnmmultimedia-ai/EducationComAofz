import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { ClassroomRow, CourseKey } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { COURSE_GRADE, COURSE_LABEL, M3 } from './courseScope'
import { useAsync } from '@/lib/useAsync'
import { fetchClassrooms, upsertClassroom } from './adminLessonsApi'

const nameSchema = z.string().trim().min(1, 'กรุณากรอกชื่อห้อง').max(30, 'ชื่อห้องยาวเกินไป')
const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'


// ห้อง + จำนวนนักเรียนในแต่ละห้อง (ใช้ตัดสินว่าลบห้องได้ไหม)
async function fetchRooms(course: CourseKey) {
  const [rooms, students] = await Promise.all([fetchClassrooms(course), supabase.from('students').select('classroom_id')])
  if (students.error) throw students.error
  const counts = new Map<string, number>()
  for (const st of students.data) if (st.classroom_id) counts.set(st.classroom_id, (counts.get(st.classroom_id) ?? 0) + 1)
  return { rooms, counts }
}

// ห้องเรียนของวิชาเดียว: /admin/classrooms = ม.3 · /db/admin/classrooms = DB Quest ม.5
export function AdminClassroomsPage({ course = M3 }: { course?: CourseKey }) {
  const state = useAsync(() => fetchRooms(course), [course])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl text-ink">ห้องเรียน {COURSE_LABEL[course]}</h1>
        <p className="text-sm text-slate-500">
          {course === M3
            ? 'เพิ่ม/แก้ชื่อห้องของวิชา ม.3 แล้วไปเปิด-ปิดคาบรายห้องที่หน้า "บทเรียน / คาบเรียน"'
            : 'เพิ่ม/แก้ชื่อห้องของ DB Quest ม.5 แล้วไปเปิด-ปิดคาบรายห้องที่หน้า "ปลดล็อกคาบ"'}
        </p>
      </div>
      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorBlock message={state.error} onRetry={state.reload} />}
      {state.status === 'success' && (
        <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
          {state.data.rooms.map((room) => (
            <RoomForm key={room.id} room={room} course={course} studentCount={state.data.counts.get(room.id) ?? 0} onSaved={state.reload} />
          ))}
          <RoomForm room={null} course={course} nextOrder={state.data.rooms.length + 1} onSaved={state.reload} />
        </section>
      )}
    </div>
  )
}

function RoomForm({
  room,
  course,
  nextOrder = 0,
  studentCount = 0,
  onSaved,
}: {
  room: ClassroomRow | null
  course: CourseKey
  nextOrder?: number
  studentCount?: number
  onSaved: () => void
}) {
  const [deleting, setDeleting] = useState<'confirm' | 'busy' | null>(null)
  const grade = COURSE_GRADE[course]
  const [name, setName] = useState(room?.name ?? '')
  const effectiveCourse = course
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
      await upsertClassroom({ id: room?.id, name: parsed.data, sort_order: room?.sort_order ?? nextOrder, course: effectiveCourse })
      setStatus('saved')
      setMessage(null)
      if (!room) {
        setName('')
      }
      onSaved()
    } catch {
      setStatus('error')
      setMessage('บันทึกไม่สำเร็จ (ชื่อห้องอาจซ้ำ)')
    }
  }

  const removeRoom = async () => {
    if (!room || studentCount > 0) return
    setDeleting('busy')
    const { error } = await supabase.from('classrooms').delete().eq('id', room.id)
    if (error) {
      setDeleting('confirm')
      setMessage('ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
      return
    }
    setDeleting(null)
    onSaved()
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        className={`${INPUT} max-w-xs`}
        aria-label={room ? `ชื่อห้อง ${room.name}` : 'ชื่อห้องใหม่'}
        placeholder={room ? '' : `เช่น ม.${grade}/2`}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setStatus('idle')
        }}
      />
      <Button type="submit" variant={room ? 'secondary' : 'primary'} loading={status === 'saving'}>
        {room ? 'บันทึก' : '+ เพิ่มห้อง'}
      </Button>
      {room && deleting === null && (
        <button
          type="button"
          onClick={() => {
            setMessage(null)
            setDeleting('confirm')
          }}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          aria-label={`ลบห้อง ${room.name}`}
        >
          <Trash2 className="size-4" aria-hidden /> ลบ
        </button>
      )}
      {status === 'saved' && room && <span className="text-mint-500">บันทึกแล้ว</span>}
      {message && <span className="text-sm text-rose-600">{message}</span>}
      {room && deleting !== null && (
        <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-100">
          {studentCount > 0 ? (
            <>
              <p className="min-w-0 flex-1 text-sm text-rose-900">
                ลบห้อง <span className="font-semibold">{room.name}</span> ไม่ได้ เพราะยังมีนักเรียน {studentCount} คน ย้ายนักเรียนไปห้องอื่นหรือลบนักเรียนออกก่อน
              </p>
              <Link to="/admin/students" className="text-sm font-semibold text-rose-800 underline underline-offset-2">
                ไปหน้านักเรียน
              </Link>
              <Button type="button" variant="secondary" className="min-h-10" onClick={() => setDeleting(null)}>
                ปิด
              </Button>
            </>
          ) : (
            <>
              <p className="min-w-0 flex-1 text-sm text-rose-900">
                ลบห้อง <span className="font-semibold">{room.name}</span> ถาวร? การเปิด-ปิดคาบของห้องนี้จะหายไปด้วย
              </p>
              <Button type="button" variant="secondary" className="min-h-10" disabled={deleting === 'busy'} onClick={() => setDeleting(null)}>
                ยกเลิก
              </Button>
              <Button
                type="button"
                className="min-h-10 bg-rose-600 shadow-none hover:bg-rose-700"
                loading={deleting === 'busy'}
                loadingText="กำลังลบ…"
                onClick={() => void removeRoom()}
              >
                ลบห้อง
              </Button>
            </>
          )}
        </div>
      )}
    </form>
  )
}
