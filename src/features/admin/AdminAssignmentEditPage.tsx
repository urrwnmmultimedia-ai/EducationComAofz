import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { AssignmentRow, ClassSessionRow } from '@/lib/database.types'
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import { parseRubric, parseTableConfig, type Rubric } from '@/features/assignments/assignmentModel'
import { deleteAssignment, fetchAssignmentsAdmin, saveAssignment } from './adminAssignmentsApi'

const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'

const formSchema = z.object({
  title: z.string().trim().min(1, 'กรุณากรอกชื่องาน').max(200),
  max_score: z.number().min(0, 'คะแนนเต็มต้องไม่ติดลบ').max(100, 'คะแนนเต็มไม่เกิน 100'),
})

// datetime-local ใช้เวลาท้องถิ่น
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function AdminAssignmentEditPage() {
  const id = useParams().id ?? 'new'
  const state = useAsync(fetchAssignmentsAdmin, [])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const existing = id === 'new' ? null : (state.data.assignments.find((a) => a.id === id) ?? null)
  if (id !== 'new' && !existing) return <ErrorBlock message="ไม่พบงานนี้" />
  return <AssignmentForm key={id} existing={existing} sessions={state.data.sessions} />
}

function AssignmentForm({ existing, sessions }: { existing: AssignmentRow | null; sessions: ClassSessionRow[] }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [sessionNo, setSessionNo] = useState<string>(existing?.session_no?.toString() ?? '')
  const [type, setType] = useState<AssignmentRow['type']>(existing?.type ?? 'text')
  const [category, setCategory] = useState<AssignmentRow['category']>(existing?.category ?? 'work')
  const [maxScore, setMaxScore] = useState(existing ? Number(existing.max_score) : 2)
  const [dueAt, setDueAt] = useState(toLocalInput(existing?.due_at ?? null))
  const [instructions, setInstructions] = useState(existing?.instructions_md ?? '')
  const [rubric, setRubric] = useState<Rubric>(parseRubric(existing?.rubric ?? []))
  const initialTable = parseTableConfig(existing?.config ?? {})
  const [columns, setColumns] = useState(initialTable.columns.join('\n'))
  const [rows, setRows] = useState(initialTable.rows)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rubricTotal = rubric.reduce((s, r) => s + r.points, 0)

  const submit = async () => {
    if (status === 'saving') return
    const parsed = formSchema.safeParse({ title, max_score: maxScore })
    if (!parsed.success) {
      setStatus('error')
      setMessage(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง')
      return
    }
    const cols = columns.split('\n').map((c) => c.trim()).filter(Boolean).slice(0, 8)
    const session = sessions.find((s) => String(s.session_no) === sessionNo)
    setStatus('saving')
    setMessage(null)
    try {
      const saved = await saveAssignment(existing?.id ?? null, {
        title: parsed.data.title,
        session_no: session?.session_no ?? null,
        unit_id: session?.unit_id ?? null,
        instructions_md: instructions,
        type,
        max_score: parsed.data.max_score,
        rubric: rubric.filter((r) => r.criterion.trim()),
        config: type === 'table' ? { columns: cols.length ? cols : ['คำตอบ'], rows: Math.min(30, Math.max(1, rows)) } : {},
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        category,
        sort_order: existing?.sort_order ?? 1,
      })
      setStatus('saved')
      if (!existing) navigate(`/admin/assignments/${saved.id}`, { replace: true })
    } catch {
      setStatus('error')
      setMessage('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  const remove = async () => {
    if (!existing) return
    setStatus('saving')
    try {
      await deleteAssignment(existing.id)
      navigate('/admin/assignments', { replace: true })
    } catch {
      setStatus('error')
      setMessage('ลบไม่สำเร็จ')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/admin/assignments" className="hover:text-brand-700">
          งาน / รายการคะแนน
        </Link>
        {' / '}
        {existing ? 'แก้ไข' : 'สร้างใหม่'}
      </nav>

      <section className="grid gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:grid-cols-2 sm:p-6">
        <Field label="ชื่องาน" className="sm:col-span-2">
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="คาบ">
          <select className={INPUT} value={sessionNo} onChange={(e) => setSessionNo(e.target.value)}>
            <option value="">– ไม่ผูกกับคาบ –</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.session_no}>
                คาบ {s.session_no} {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="หมวดคะแนน">
          <select className={INPUT} value={category} onChange={(e) => setCategory(e.target.value as AssignmentRow['category'])}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="รูปแบบการส่ง">
          <select className={INPUT} value={type} onChange={(e) => setType(e.target.value as AssignmentRow['type'])}>
            <option value="text">ข้อความ</option>
            <option value="table">ตาราง</option>
            <option value="file">อัปโหลดไฟล์ (รูป/PDF)</option>
            <option value="link">ลิงก์</option>
            <option value="score_only">ไม่ต้องส่ง (สอบ/ครูกรอกคะแนน)</option>
          </select>
        </Field>
        <Field label="คะแนนเต็ม">
          <input className={INPUT} type="number" min={0} max={100} step={0.5} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} />
        </Field>
        <Field label="กำหนดส่ง (ว่าง = ไม่มีกำหนด)" className="sm:col-span-2">
          <input className={INPUT} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </Field>
        <Field label="คำชี้แจง (Markdown)" className="sm:col-span-2">
          <textarea className={`${INPUT} min-h-32`} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>

        {type === 'table' && (
          <>
            <Field label="หัวคอลัมน์ (บรรทัดละ 1 คอลัมน์ สูงสุด 8)">
              <textarea className={`${INPUT} min-h-28`} value={columns} onChange={(e) => setColumns(e.target.value)} />
            </Field>
            <Field label="จำนวนแถวเริ่มต้น">
              <input className={INPUT} type="number" min={1} max={30} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
            </Field>
          </>
        )}

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm text-slate-600">
            เกณฑ์การให้คะแนน (rubric){' '}
            <span className={rubricTotal === maxScore || rubric.length === 0 ? 'text-slate-400' : 'text-amber-600'}>
              รวม {rubricTotal} / {maxScore}
            </span>
          </p>
          <div className="flex flex-col gap-2">
            {rubric.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={INPUT}
                  aria-label={`เกณฑ์ข้อ ${i + 1}`}
                  value={r.criterion}
                  onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))}
                />
                <input
                  className={`${INPUT} w-24`}
                  type="number"
                  min={0}
                  step={0.5}
                  aria-label={`คะแนนเกณฑ์ข้อ ${i + 1}`}
                  value={r.points}
                  onChange={(e) => setRubric(rubric.map((x, j) => (j === i ? { ...x, points: Math.max(0, Number(e.target.value)) } : x)))}
                />
                <button type="button" aria-label="ลบเกณฑ์" className="px-2 text-rose-600" onClick={() => setRubric(rubric.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-sm text-brand-700 underline" onClick={() => setRubric([...rubric, { criterion: '', points: 1 }])}>
            + เพิ่มเกณฑ์
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <div className="flex items-center gap-3">
            <Button loading={status === 'saving'} onClick={() => void submit()}>
              บันทึก
            </Button>
            {status === 'saved' && <span className="text-mint-500">บันทึกแล้ว ✓</span>}
            {message && <span className="text-rose-600">{message}</span>}
          </div>
          {existing &&
            (confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                ลบงานและคะแนนที่นักเรียนส่งทั้งหมด?
                <Button variant="danger" className="min-h-8 px-3 py-1 text-sm" onClick={() => void remove()}>
                  ยืนยันลบ
                </Button>
                <Button variant="ghost" className="min-h-8 px-3 py-1 text-sm" onClick={() => setConfirmDelete(false)}>
                  ยกเลิก
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="text-rose-600" onClick={() => setConfirmDelete(true)}>
                ลบงาน
              </Button>
            ))}
        </div>
      </section>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </label>
  )
}
