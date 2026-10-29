import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { FeedbackChips, ScoreQuickPicks } from '@/components/QuickGrade'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { StudentRow, SubmissionRow } from '@/lib/database.types'
import { isLate } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import { parseRubric } from '@/features/assignments/assignmentModel'
import { signedUrls } from '@/features/assignments/assignmentsApi'
import { fullName } from '@/features/assignments/gradebookData'
import { SubmissionView } from '@/features/assignments/SubmissionView'
import { Markdown } from '@/features/lessons/Markdown'
import { fetchGradingData, gradeSubmission, setScore, type GradingData } from './adminAssignmentsApi'

type Filter = 'pending' | 'all'

const STATUS_CHIP: Record<SubmissionRow['status'] | 'none', string> = {
  none: 'bg-slate-100 text-slate-500',
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-sky-100 text-sky-800',
  returned: 'bg-amber-100 text-amber-800',
  graded: 'bg-emerald-100 text-emerald-800',
}
const STATUS_TEXT: Record<SubmissionRow['status'] | 'none', string> = {
  none: 'ยังไม่ส่ง',
  draft: 'ร่าง',
  submitted: 'รอตรวจ',
  returned: 'ส่งคืน',
  graded: 'ตรวจแล้ว',
}

export function AdminGradingPage() {
  const id = useParams().id ?? ''
  const state = useAsync(() => fetchGradingData(id), [id])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data) return <ErrorBlock message="ไม่พบงานนี้" />
  return <Grader data={state.data} />
}

function Grader({ data }: { data: GradingData }) {
  const { assignment, classrooms } = data
  const [subs, setSubs] = useState<SubmissionRow[]>(data.submissions)
  const [roomId, setRoomId] = useState(classrooms[0]?.id ?? '')
  const [filter, setFilter] = useState<Filter>(assignment.type === 'score_only' ? 'all' : 'pending')
  const subByStudent = useMemo(() => new Map(subs.map((s) => [s.student_id, s])), [subs])

  const students = data.students.filter((s) => !roomId || s.classroom_id === roomId)
  const visible = filter === 'pending' ? students.filter((s) => subByStudent.get(s.id)?.status === 'submitted') : students
  const [selectedId, setSelectedId] = useState<string | null>(visible[0]?.id ?? null)
  const selected = students.find((s) => s.id === selectedId) ?? visible[0] ?? null

  const pendingCount = students.filter((s) => subByStudent.get(s.id)?.status === 'submitted').length
  const gradedCount = students.filter((s) => subByStudent.get(s.id)?.status === 'graded').length

  const goNext = () => {
    if (!selected) return
    const list = students
    const start = list.findIndex((s) => s.id === selected.id)
    const rest = [...list.slice(start + 1), ...list.slice(0, start)]
    const next = rest.find((s) => subByStudent.get(s.id)?.status === 'submitted') ?? list[start + 1] ?? null
    setSelectedId(next?.id ?? null)
  }

  const onSaved = (studentId: string, patch: Partial<SubmissionRow>) => {
    setSubs((list) => {
      const existing = list.find((s) => s.student_id === studentId)
      if (existing) return list.map((s) => (s.student_id === studentId ? { ...s, ...patch } : s))
      return [
        ...list,
        {
          id: `local-${studentId}`,
          assignment_id: assignment.id,
          student_id: studentId,
          content: {},
          file_paths: [],
          submitted_at: null,
          score: null,
          feedback: null,
          status: 'graded',
          updated_at: '',
          ...patch,
        },
      ]
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-sm text-slate-500">
        <Link to="/admin/assignments" className="hover:text-brand-700">
          งาน / รายการคะแนน
        </Link>
        {' / '}ตรวจงาน
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">{assignment.title}</h1>
          <p className="text-sm text-slate-500">
            คะแนนเต็ม {Number(assignment.max_score)} · รอตรวจ {pendingCount} · ตรวจแล้ว {gradedCount}/{students.length}
          </p>
          <div className="mt-1.5 h-2 w-64 max-w-full overflow-hidden rounded-full bg-brand-50">
            <div className="h-full rounded-full bg-gradient-to-r from-mint-400 to-mint-500 transition-[width]" style={{ width: `${students.length ? (gradedCount / students.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2 text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="ห้องเรียน">
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="">ทุกห้อง</option>
          </select>
          <select className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="ตัวกรอง">
            <option value="pending">เฉพาะรอตรวจ</option>
            <option value="all">ทุกคน</option>
          </select>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="max-h-[70vh] overflow-y-auto rounded-3xl bg-white p-2 shadow-sm ring-1 ring-brand-100">
          {visible.length === 0 ? (
            <p className="p-4 text-center text-sm text-slate-500">{filter === 'pending' ? 'ไม่มีงานรอตรวจ 🎉' : 'ไม่มีนักเรียน'}</p>
          ) : (
            <ul>
              {visible.map((s) => {
                const sub = subByStudent.get(s.id)
                const st = sub?.status ?? 'none'
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${selected?.id === s.id ? 'bg-brand-100' : 'hover:bg-brand-50'}`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-slate-400">{s.number ?? '-'}.</span> {s.nickname || s.first_name}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 text-xs ${STATUS_CHIP[st]}`}>
                        {st === 'graded' && sub?.score != null ? Number(sub.score) : STATUS_TEXT[st]}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {selected ? (
          <GradePanel
            key={selected.id}
            data={data}
            student={selected}
            submission={subByStudent.get(selected.id) ?? null}
            onSaved={(patch) => onSaved(selected.id, patch)}
            onNext={goNext}
          />
        ) : (
          <EmptyBlock>เลือกนักเรียนทางซ้ายเพื่อเริ่มตรวจ</EmptyBlock>
        )}
      </div>
    </div>
  )
}

function GradePanel({
  data,
  student,
  submission,
  onSaved,
  onNext,
}: {
  data: GradingData
  student: StudentRow
  submission: SubmissionRow | null
  onSaved: (patch: Partial<SubmissionRow>) => void
  onNext: () => void
}) {
  const { assignment } = data
  const max = Number(assignment.max_score)
  const rubric = parseRubric(assignment.rubric)
  const [rubricPoints, setRubricPoints] = useState<number[]>(() => rubric.map(() => 0))
  const [score, setScoreText] = useState(submission?.score != null ? String(Number(submission.score)) : '')
  const [feedback, setFeedback] = useState(submission?.feedback ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [urls, setUrls] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let cancelled = false
    if (submission?.file_paths.length) {
      signedUrls(submission.file_paths).then(
        (m) => !cancelled && setUrls(m),
        () => undefined,
      )
    }
    return () => {
      cancelled = true
    }
  }, [submission?.file_paths])

  const late = submission?.submitted_at ? isLate({ dueAt: assignment.due_at }, { submittedAt: submission.submitted_at }) : false

  const save = async (mode: 'graded' | 'returned', thenNext: boolean, override?: number) => {
    if (status === 'saving') return
    const text = override != null ? String(override) : score
    const n = text.trim() === '' ? null : Number(text)
    if (mode === 'graded' && (n == null || !Number.isFinite(n) || n < 0 || n > max)) {
      setStatus('error')
      setMessage(`คะแนนต้องอยู่ระหว่าง 0–${max}`)
      return
    }
    setStatus('saving')
    setMessage(null)
    try {
      if (submission && !submission.id.startsWith('local-')) {
        await gradeSubmission(submission.id, mode === 'graded' ? n : (n ?? null), feedback, mode)
      } else {
        // ยังไม่มีงานส่งในเว็บ (เช่น ส่งกระดาษ) — กรอกคะแนนตรง
        if (mode === 'returned') {
          setStatus('error')
          setMessage('นักเรียนยังไม่ได้ส่งงานในเว็บ จึงส่งคืนไม่ได้')
          return
        }
        await setScore(assignment.id, student.id, n)
      }
      onSaved({ score: n, feedback: feedback.trim() || null, status: mode })
      setStatus('saved')
      if (thenNext) onNext()
    } catch {
      setStatus('error')
      setMessage('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg text-brand-900">
            {student.number ?? '-'}. {fullName(student)} {student.nickname && `(${student.nickname})`}
          </h2>
          <p className="text-sm text-slate-500">
            รหัส {student.student_code}
            {submission?.submitted_at && ` · ส่งเมื่อ ${new Date(submission.submitted_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`}
            {late && <span className="ml-2 rounded-full bg-rose-100 px-2 text-rose-700">ส่งช้า</span>}
          </p>
        </div>
        <Button variant="secondary" onClick={onNext}>
          ถัดไป →
        </Button>
      </div>

      {assignment.type !== 'score_only' &&
        (submission && submission.status !== 'draft' ? (
          <SubmissionView assignment={assignment} submission={submission} fileUrls={urls} />
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-slate-500">
            {submission?.status === 'draft' ? 'นักเรียนบันทึกร่างไว้ แต่ยังไม่กดส่ง' : 'ยังไม่ส่งงานในเว็บ (กรอกคะแนนได้ถ้าส่งเป็นกระดาษ)'}
          </p>
        ))}

      {assignment.instructions_md && assignment.type !== 'score_only' && (
        <details className="rounded-2xl bg-brand-50 p-3 text-sm">
          <summary className="cursor-pointer font-display text-brand-700">คำชี้แจงงาน</summary>
          <Markdown text={assignment.instructions_md} />
        </details>
      )}

      <div className="grid gap-4 rounded-2xl bg-brand-50 p-4 sm:grid-cols-2">
        {rubric.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm text-slate-600">ให้คะแนนตาม rubric (กดรวมเป็นคะแนน)</p>
            <ul className="flex flex-col gap-1.5">
              {rubric.map((r, i) => (
                <li key={r.criterion} className="flex items-center justify-between gap-2 text-sm">
                  <span>{r.criterion}</span>
                  <input
                    type="number"
                    min={0}
                    max={r.points}
                    step={0.5}
                    aria-label={`คะแนน ${r.criterion}`}
                    className="w-20 rounded-lg border-2 border-brand-100 px-2 py-1"
                    value={rubricPoints[i] ?? 0}
                    onChange={(e) => {
                      const next = rubricPoints.map((p, j) => (j === i ? Math.min(r.points, Math.max(0, Number(e.target.value))) : p))
                      setRubricPoints(next)
                      setScoreText(String(next.reduce((s, p) => s + p, 0)))
                    }}
                  />
                  <span className="w-12 text-right text-slate-400">/ {r.points}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">คะแนน (เต็ม {max}) · กด Enter = บันทึกแล้วไปคนถัดไป</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={max}
            step={0.5}
            autoFocus
            className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2 font-display text-xl"
            value={score}
            onChange={(e) => {
              setScoreText(e.target.value)
              setStatus('idle')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void save('graded', true)
              }
            }}
          />
          <ScoreQuickPicks
            max={max}
            value={score}
            disabled={status === 'saving'}
            onPick={(v) => {
              setScoreText(String(v))
              setStatus('idle')
            }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">คอมเมนต์ถึงนักเรียน</span>
          <textarea
            rows={3}
            className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2"
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value)
              setStatus('idle')
            }}
          />
          <FeedbackChips
            value={feedback}
            onChange={(v) => {
              setFeedback(v)
              setStatus('idle')
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={status === 'saving'} onClick={() => void save('graded', true)}>
          บันทึกคะแนน แล้วไปคนถัดไป
        </Button>
        <Button variant="secondary" disabled={status === 'saving'} onClick={() => void save('graded', true, max)}>
          ✓ ให้เต็ม {max} แล้วไปคนถัดไป
        </Button>
        <Button variant="secondary" disabled={status === 'saving'} onClick={() => void save('graded', false)}>
          บันทึกคะแนน
        </Button>
        {assignment.type !== 'score_only' && submission && submission.status !== 'draft' && (
          <Button variant="ghost" disabled={status === 'saving'} onClick={() => void save('returned', true)}>
            ↩ ส่งคืนให้แก้
          </Button>
        )}
        {status === 'saved' && <span className="text-mint-500">บันทึกแล้ว ✓</span>}
        {message && <span className="text-rose-600">{message}</span>}
      </div>
    </section>
  )
}
