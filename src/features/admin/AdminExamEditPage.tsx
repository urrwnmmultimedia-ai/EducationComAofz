import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { AssignmentRow, ClassSessionRow, ExamRow, QuestionRow, UnitRow } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { QUESTION_TYPE_LABELS } from '@/features/exams/examModel'
import { EXAM_KIND_LABELS } from '@/features/exams/examsApi'

const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500'

async function fetchData(id: string) {
  const [e, q, s, a, u] = await Promise.all([
    id === 'new' ? Promise.resolve({ data: null, error: null }) : supabase.from('exams').select('*').eq('id', id).maybeSingle(),
    supabase.from('questions').select('*').order('created_at'),
    supabase.from('class_sessions').select('*').order('session_no'),
    supabase.from('assignments').select('*').eq('type', 'score_only'),
    supabase.from('units').select('*').order('no'),
  ])
  for (const r of [e, q, s, a, u]) if (r.error) throw r.error
  return { exam: e.data, questions: q.data ?? [], sessions: s.data ?? [], assignments: a.data ?? [], units: u.data ?? [] }
}

const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function AdminExamEditPage() {
  const id = useParams().id ?? 'new'
  const state = useAsync(() => fetchData(id), [id])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (id !== 'new' && !state.data.exam) return <ErrorBlock message="ไม่พบชุดสอบนี้" />
  return <ExamForm key={id} {...state.data} />
}

function ExamForm({
  exam,
  questions,
  sessions,
  assignments,
  units,
}: {
  exam: ExamRow | null
  questions: QuestionRow[]
  sessions: ClassSessionRow[]
  assignments: AssignmentRow[]
  units: UnitRow[]
}) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(exam?.title ?? '')
  const [kind, setKind] = useState<ExamRow['kind']>(exam?.kind ?? 'exit_ticket')
  const [sessionNo, setSessionNo] = useState(exam?.session_no?.toString() ?? '')
  const [assignmentId, setAssignmentId] = useState(exam?.assignment_id ?? '')
  const [duration, setDuration] = useState(exam?.duration_min?.toString() ?? '10')
  const [opensAt, setOpensAt] = useState(toLocal(exam?.opens_at ?? null))
  const [closesAt, setClosesAt] = useState(toLocal(exam?.closes_at ?? null))
  const [shuffle, setShuffle] = useState(exam?.shuffle ?? false)
  const [shuffleChoices, setShuffleChoices] = useState(exam?.shuffle_choices ?? false)
  const [maxAttempts, setMaxAttempts] = useState(exam?.max_attempts ?? 1)
  const [showAnswers, setShowAnswers] = useState(exam?.show_answers ?? false)
  const [fullscreen, setFullscreen] = useState(exam?.require_fullscreen ?? false)
  const [selected, setSelected] = useState<string[]>(exam?.question_ids ?? [])
  const [filterUnit, setFilterUnit] = useState('all')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions])
  const pool = questions.filter((q) => !selected.includes(q.id) && (filterUnit === 'all' || q.unit_id === filterUnit))

  const save = async () => {
    if (saving) return
    if (!title.trim()) return setMessage({ ok: false, text: 'กรุณากรอกชื่อชุดสอบ' })
    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) return setMessage({ ok: false, text: 'เวลาปิดต้องหลังเวลาเปิด' })
    setSaving(true)
    const session = sessions.find((s) => String(s.session_no) === sessionNo)
    const row = {
      title: title.trim(),
      kind,
      session_no: session?.session_no ?? null,
      unit_id: session?.unit_id ?? null,
      assignment_id: assignmentId || null,
      question_ids: selected,
      duration_min: duration ? Math.max(1, Number(duration)) : null,
      opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      shuffle,
      shuffle_choices: shuffleChoices,
      max_attempts: Math.max(1, maxAttempts),
      show_answers: showAnswers,
      require_fullscreen: fullscreen,
    }
    const res = exam ? await supabase.from('exams').update(row).eq('id', exam.id).select('id').single() : await supabase.from('exams').insert(row).select('id').single()
    setSaving(false)
    if (res.error) return setMessage({ ok: false, text: 'บันทึกไม่สำเร็จ' })
    setMessage({ ok: true, text: 'บันทึกแล้ว ✓' })
    if (!exam) navigate(`/admin/exams/${res.data.id}`, { replace: true })
  }

  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= selected.length) return
    const next = [...selected]
    ;[next[i], next[j]] = [next[j] as string, next[i] as string]
    setSelected(next)
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/admin/exams" className="hover:text-brand-700">
          ชุดสอบ
        </Link>
        {' / '}
        {exam ? 'ตั้งค่า' : 'สร้างใหม่'}
      </nav>

      <section className="grid gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:grid-cols-3 sm:p-6">
        <Field label="ชื่อชุดสอบ" className="sm:col-span-2">
          <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="ประเภท">
          <select className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as ExamRow['kind'])}>
            {Object.entries(EXAM_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="คาบ (นักเรียนทำได้เมื่อคาบนี้ปลดล็อก)">
          <select className={INPUT} value={sessionNo} onChange={(e) => setSessionNo(e.target.value)}>
            <option value="">– ไม่ผูกคาบ –</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.session_no}>
                คาบ {s.session_no} {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ลงคะแนนในสมุดคะแนนที่">
          <select className={INPUT} value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
            <option value="">– ไม่ลงคะแนน (ให้ XP อย่างเดียว) –</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({Number(a.max_score)} คะแนน)
              </option>
            ))}
          </select>
        </Field>
        <Field label="เวลาทำ (นาที, ว่าง = ไม่จำกัด)">
          <input className={INPUT} type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="เปิดสอบ (ว่าง = เปิดเมื่อคาบปลดล็อก)">
          <input className={INPUT} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
        </Field>
        <Field label="ปิดสอบ (ว่าง = ไม่ปิด)">
          <input className={INPUT} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </Field>
        <Field label="จำนวนครั้งที่ทำได้">
          <input className={INPUT} type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} />
        </Field>
        <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-3">
          <Check label="สุ่มลำดับข้อ" checked={shuffle} onChange={setShuffle} />
          <Check label="สุ่มลำดับตัวเลือก" checked={shuffleChoices} onChange={setShuffleChoices} />
          <Check label="แสดงเฉลยหลังส่ง" checked={showAnswers} onChange={setShowAnswers} />
          <Check label="บังคับเต็มจอ + เตือนสลับแท็บ" checked={fullscreen} onChange={setFullscreen} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100">
          <h2 className="mb-2 text-lg text-brand-900">ข้อสอบในชุด ({selected.length} ข้อ)</h2>
          <ol className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {selected.map((id, i) => {
              const q = qById.get(id)
              return (
                <li key={id} className="flex items-start gap-2 rounded-xl bg-brand-50 p-2 text-sm">
                  <span className="w-6 shrink-0 text-right font-display text-brand-600">{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    {q ? q.prompt : <span className="text-rose-600">(ข้อนี้ถูกลบจากคลังแล้ว)</span>}
                    {q && !q.reviewed && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">ยังไม่ตรวจ</span>}
                  </span>
                  <button type="button" aria-label="เลื่อนขึ้น" onClick={() => move(i, -1)} className="px-1 text-slate-500">
                    ↑
                  </button>
                  <button type="button" aria-label="เลื่อนลง" onClick={() => move(i, 1)} className="px-1 text-slate-500">
                    ↓
                  </button>
                  <button type="button" aria-label="นำออก" onClick={() => setSelected(selected.filter((x) => x !== id))} className="px-1 text-rose-600">
                    ✕
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg text-brand-900">เลือกจากคลัง</h2>
            <select className="rounded-xl border-2 border-brand-100 px-2 py-1 text-sm" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} aria-label="กรองหน่วย">
              <option value="all">ทุกหน่วย</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  หน่วยที่ {u.no}
                </option>
              ))}
            </select>
          </div>
          <ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
            {pool.map((q) => (
              <li key={q.id}>
                <button type="button" onClick={() => setSelected([...selected, q.id])} className="flex w-full items-start gap-2 rounded-xl p-2 text-left text-sm hover:bg-brand-50">
                  <span className="font-display text-brand-600">+</span>
                  <span className="min-w-0 flex-1">
                    {q.prompt}
                    <span className="ml-1 text-xs text-slate-400">
                      {QUESTION_TYPE_LABELS[q.type]} · {q.topic}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={saving} onClick={() => void save()}>
          บันทึกชุดสอบ
        </Button>
        {message && <span className={message.ok ? 'text-mint-500' : 'text-rose-600'}>{message.text}</span>}
      </div>
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

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" className="size-5 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
