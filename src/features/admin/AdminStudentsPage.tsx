import { useRef, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { ClassroomRow, StudentRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { fullName } from '@/features/assignments/gradebookData'
import { downloadWorkbook, readTableFile } from './exportExcel'
import { IMPORT_TEMPLATE_HEADER, parseStudentTable, type ImportResult } from './studentImport'

const INPUT = 'w-full rounded-lg border-2 border-brand-100 bg-white px-2 py-1 outline-none focus:border-brand-500'

const studentSchema = z.object({
  student_code: z.string().regex(/^[0-9]{3,12}$/, 'รหัสต้องเป็นตัวเลข 3–12 หลัก'),
  prefix: z.string().max(30),
  first_name: z.string().trim().min(1, 'กรุณากรอกชื่อ'),
  last_name: z.string().max(80),
  nickname: z.string().max(40),
  classroom_id: z.string().nullable(),
  number: z.number().int().min(1).max(99).nullable(),
})
type StudentForm = z.infer<typeof studentSchema>

async function fetchData() {
  const [s, c] = await Promise.all([
    supabase.from('students').select('*').order('student_code'),
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
  ])
  if (s.error) throw s.error
  if (c.error) throw c.error
  return { students: s.data, classrooms: c.data }
}

export function AdminStudentsPage() {
  const state = useAsync(fetchData, [])
  const [roomId, setRoomId] = useState<string>('all')
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { students, classrooms } = state.data
  const visible = students
    .filter((s) => roomId === 'all' || s.classroom_id === roomId)
    .sort((a, b) => (a.classroom_id ?? '').localeCompare(b.classroom_id ?? '') || (a.number ?? 99) - (b.number ?? 99))
  const roomName = new Map(classrooms.map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">นักเรียน</h1>
          <p className="text-sm text-slate-500">ทั้งหมด {students.length} คน · ใช้งานอยู่ {students.filter((s) => s.is_active).length} คน</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="ห้องเรียน">
            <option value="all">ทุกห้อง</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setEditing('new')}>+ เพิ่มนักเรียน</Button>
        </div>
      </div>

      <ImportPanel onImported={state.reload} />

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-brand-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">รหัส</th>
              <th className="px-3 py-2 font-medium">คำนำหน้า</th>
              <th className="px-3 py-2 font-medium">ชื่อ</th>
              <th className="px-3 py-2 font-medium">นามสกุล</th>
              <th className="px-3 py-2 font-medium">ชื่อเล่น</th>
              <th className="px-3 py-2 font-medium">ห้อง</th>
              <th className="px-3 py-2 font-medium">เลขที่</th>
              <th className="px-3 py-2 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {editing === 'new' && (
              <EditRow student={null} classrooms={classrooms} defaultRoom={roomId === 'all' ? null : roomId} onDone={() => (setEditing(null), state.reload())} onCancel={() => setEditing(null)} />
            )}
            {visible.map((s) =>
              editing === s.id ? (
                <EditRow key={s.id} student={s} classrooms={classrooms} defaultRoom={null} onDone={() => (setEditing(null), state.reload())} onCancel={() => setEditing(null)} />
              ) : (
                <ViewRow key={s.id} student={s} roomName={s.classroom_id ? (roomName.get(s.classroom_id) ?? '-') : '-'} onEdit={() => setEditing(s.id)} onChanged={state.reload} />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ViewRow({ student: s, roomName, onEdit, onChanged }: { student: StudentRow; roomName: string; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<'active' | 'device' | null>(null)
  const [error, setError] = useState(false)

  const run = async (kind: 'active' | 'device') => {
    if (busy) return
    setBusy(kind)
    setError(false)
    const { error: err } =
      kind === 'active'
        ? await supabase.from('students').update({ is_active: !s.is_active }).eq('id', s.id)
        : await supabase.rpc('admin_reset_device', { p_student_id: s.id })
    setBusy(null)
    if (err) setError(true)
    else onChanged()
  }

  return (
    <tr className={`border-t border-brand-50 ${s.is_active ? '' : 'text-slate-400'}`}>
      <td className="px-3 py-2 font-mono">{s.student_code}</td>
      <td className="px-3 py-2">{s.prefix}</td>
      <td className="px-3 py-2">{s.first_name}</td>
      <td className="px-3 py-2">{s.last_name}</td>
      <td className="px-3 py-2">{s.nickname}</td>
      <td className="px-3 py-2">{roomName}</td>
      <td className="px-3 py-2">{s.number ?? '-'}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={onEdit} className="rounded-lg px-2 py-1 font-display text-brand-700 hover:bg-brand-100">
            แก้ไข
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void run('active')} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-brand-100 disabled:opacity-50">
            {busy === 'active' ? 'กำลังบันทึก…' : s.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
          </button>
          {s.bound_device_key && (
            <button type="button" disabled={busy !== null} onClick={() => void run('device')} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-brand-100 disabled:opacity-50">
              {busy === 'device' ? 'กำลังรีเซ็ต…' : 'รีเซ็ตอุปกรณ์'}
            </button>
          )}
          {error && <span className="text-rose-600">ไม่สำเร็จ</span>}
        </div>
      </td>
    </tr>
  )
}

function EditRow({
  student,
  classrooms,
  defaultRoom,
  onDone,
  onCancel,
}: {
  student: StudentRow | null
  classrooms: ClassroomRow[]
  defaultRoom: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const [f, setF] = useState<StudentForm>({
    student_code: student?.student_code ?? '',
    prefix: student?.prefix ?? '',
    first_name: student?.first_name ?? '',
    last_name: student?.last_name ?? '',
    nickname: student?.nickname ?? '',
    classroom_id: student?.classroom_id ?? defaultRoom ?? classrooms[0]?.id ?? null,
    number: student?.number ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof StudentForm>(k: K, v: StudentForm[K]) => setF((x) => ({ ...x, [k]: v }))

  const save = async () => {
    if (saving) return
    const parsed = studentSchema.safeParse({ ...f, student_code: f.student_code.trim() })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = student
      ? await supabase.from('students').update(parsed.data).eq('id', student.id)
      : await supabase.from('students').insert(parsed.data)
    setSaving(false)
    if (err) setError(err.code === '23505' ? 'รหัสนักเรียนนี้มีอยู่แล้ว' : 'บันทึกไม่สำเร็จ')
    else onDone()
  }

  return (
    <tr className="border-t border-brand-50 bg-sun-300/20">
      <td className="px-2 py-2">
        <input className={`${INPUT} w-24 font-mono`} inputMode="numeric" aria-label="รหัส" value={f.student_code} onChange={(e) => set('student_code', e.target.value.replace(/\D/g, ''))} />
      </td>
      <td className="px-2 py-2">
        <input className={`${INPUT} w-24`} aria-label="คำนำหน้า" list="prefixes" value={f.prefix} onChange={(e) => set('prefix', e.target.value)} />
        <datalist id="prefixes">
          <option value="เด็กชาย" />
          <option value="เด็กหญิง" />
          <option value="นาย" />
          <option value="นางสาว" />
        </datalist>
      </td>
      <td className="px-2 py-2">
        <input className={INPUT} aria-label="ชื่อ" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input className={INPUT} aria-label="นามสกุล" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <input className={`${INPUT} w-24`} aria-label="ชื่อเล่น" value={f.nickname} onChange={(e) => set('nickname', e.target.value)} />
      </td>
      <td className="px-2 py-2">
        <select className={INPUT} aria-label="ห้อง" value={f.classroom_id ?? ''} onChange={(e) => set('classroom_id', e.target.value || null)}>
          <option value="">–</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          className={`${INPUT} w-16`}
          inputMode="numeric"
          aria-label="เลขที่"
          value={f.number ?? ''}
          onChange={(e) => set('number', e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')))}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <Button className="min-h-8 px-3 py-1 text-sm" loading={saving} onClick={() => void save()}>
            บันทึก
          </Button>
          <Button variant="ghost" className="min-h-8 px-2 py-1 text-sm" onClick={onCancel}>
            ยกเลิก
          </Button>
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      </td>
    </tr>
  )
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'idle' | 'reading' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const onFile = async (file: File) => {
    setStatus('reading')
    setMessage(null)
    setFileName(file.name)
    try {
      setResult(parseStudentTable(await readTableFile(file)))
      setStatus('idle')
    } catch {
      setResult(null)
      setStatus('error')
      setMessage('อ่านไฟล์ไม่ได้ ใช้ไฟล์ .xlsx หรือ .csv')
    }
  }

  const confirm = async () => {
    if (!result || result.rows.length === 0 || status === 'saving') return
    setStatus('saving')
    const { data, error } = await supabase.rpc('admin_import_students', { p_rows: result.rows })
    if (error) {
      setStatus('error')
      setMessage('นำเข้าไม่สำเร็จ ตรวจข้อมูลแล้วลองใหม่')
      return
    }
    const r = z.object({ inserted: z.number(), updated: z.number() }).safeParse(data)
    setStatus('done')
    setMessage(r.success ? `นำเข้าแล้ว ✓ เพิ่มใหม่ ${r.data.inserted} คน อัปเดต ${r.data.updated} คน` : 'นำเข้าแล้ว ✓')
    setResult(null)
    onImported()
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg text-brand-900">นำเข้าจาก Excel / CSV</h2>
        <Button
          variant="ghost"
          onClick={() =>
            void downloadWorkbook('แม่แบบรายชื่อนักเรียน.xlsx', [
              { name: 'รายชื่อ', rows: [IMPORT_TEMPLATE_HEADER, ['10001', 'เด็กชาย', 'ธนกร', 'ใจดี', 'กล้า', 'ม.3/1', 1]], colWidths: [10, 10, 16, 16, 10, 8, 6] },
            ])
          }
        >
          ⬇ ดาวน์โหลดแม่แบบ
        </Button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onFile(file)
            e.target.value = ''
          }}
        />
        <Button variant="secondary" loading={status === 'reading'} loadingText="กำลังอ่านไฟล์…" onClick={() => input.current?.click()}>
          📂 เลือกไฟล์
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">คอลัมน์: {IMPORT_TEMPLATE_HEADER.join(', ')} · รหัสที่มีอยู่แล้วจะถูกอัปเดต · ห้องที่ยังไม่มีจะถูกสร้างให้</p>

      {result && (
        <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-brand-50 p-3 text-sm">
          <p className="font-display text-slate-800">{fileName}</p>
          {result.missingColumns.length > 0 ? (
            <p className="text-rose-700">ไม่พบคอลัมน์: {result.missingColumns.join(', ')}</p>
          ) : (
            <>
              <p>
                พร้อมนำเข้า <b>{result.rows.length}</b> คน
                {result.issues.length > 0 && <span className="text-amber-700"> · ข้าม {result.issues.length} แถวที่มีปัญหา</span>}
              </p>
              {result.issues.length > 0 && (
                <ul className="max-h-32 overflow-y-auto text-amber-800">
                  {result.issues.map((i) => (
                    <li key={i.line}>
                      แถว {i.line}: {i.message}
                    </li>
                  ))}
                </ul>
              )}
              {result.rows.length > 0 && (
                <ul className="max-h-40 overflow-y-auto text-slate-600">
                  {result.rows.slice(0, 50).map((r) => (
                    <li key={r.student_code}>
                      {r.student_code} {fullName(r)} {r.nickname && `(${r.nickname})`} {r.classroom} {r.number != null && `เลขที่ ${r.number}`}
                    </li>
                  ))}
                  {result.rows.length > 50 && <li>…และอีก {result.rows.length - 50} คน</li>}
                </ul>
              )}
              <div className="flex gap-2">
                <Button loading={status === 'saving'} disabled={result.rows.length === 0} onClick={() => void confirm()}>
                  ยืนยันนำเข้า {result.rows.length} คน
                </Button>
                <Button variant="ghost" onClick={() => setResult(null)}>
                  ยกเลิก
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {message && <p className={`mt-2 text-sm ${status === 'error' ? 'text-rose-600' : 'text-mint-500'}`}>{message}</p>}
    </section>
  )
}
