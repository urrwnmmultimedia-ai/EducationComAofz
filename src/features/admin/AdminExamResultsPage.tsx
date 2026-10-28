import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { ExamAttemptRow, QuestionRow, StudentRow } from '@/lib/database.types'
import { analyzeItems } from '@/lib/itemAnalysis'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { describeAnswer } from '@/features/exams/ExamResultView'
import { fullName } from '@/features/assignments/gradebookData'

async function fetchData(id: string) {
  const exam = await supabase.from('exams').select('*').eq('id', id).maybeSingle()
  if (exam.error) throw exam.error
  if (!exam.data) return null
  const pairKind = exam.data.kind === 'posttest' ? 'pretest' : exam.data.kind === 'pretest' ? 'posttest' : null
  const [att, q, st, c, pair] = await Promise.all([
    supabase.from('exam_attempts').select('*').eq('exam_id', id).order('started_at'),
    supabase.from('questions').select('*').in('id', exam.data.question_ids.length ? exam.data.question_ids : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('students').select('*').order('number'),
    supabase.from('classrooms').select('*').order('sort_order').order('name'),
    pairKind ? supabase.from('exams').select('id, title').eq('kind', pairKind).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  for (const r of [att, q, st, c, pair]) if (r.error) throw r.error
  let pairAttempts: ExamAttemptRow[] = []
  if (pair.data) {
    const pa = await supabase.from('exam_attempts').select('*').eq('exam_id', pair.data.id)
    if (pa.error) throw pa.error
    pairAttempts = pa.data
  }
  return {
    exam: exam.data,
    attempts: att.data ?? [],
    questions: q.data ?? [],
    students: st.data ?? [],
    classrooms: c.data ?? [],
    pair: pair.data ? { title: pair.data.title, kind: pairKind, attempts: pairAttempts } : null,
  }
}

const pointsOf = (a: ExamAttemptRow): Record<string, number | null> => {
  const raw = (a.points ?? {}) as Record<string, unknown>
  const out: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'number' ? v : null
  return out
}

export function AdminExamResultsPage() {
  const id = useParams().id ?? ''
  const state = useAsync(() => fetchData(id), [id])
  const [roomId, setRoomId] = useState('all')
  const [openAttempt, setOpenAttempt] = useState<string | null>(null)
  const [rescoring, setRescoring] = useState(false)

  const data = state.status === 'success' ? state.data : null
  const studentById = useMemo(() => new Map((data?.students ?? []).map((s) => [s.id, s])), [data])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!data) return <ErrorBlock message="ไม่พบชุดสอบนี้" />
  const { exam, attempts, questions, classrooms, pair } = data
  const qById = new Map(questions.map((q) => [q.id, q]))
  const inRoom = (sid: string) => roomId === 'all' || studentById.get(sid)?.classroom_id === roomId
  const submitted = attempts.filter((a) => a.submitted_at && inRoom(a.student_id))
  const max = submitted[0]?.max_points ? Number(submitted[0].max_points) : exam.question_ids.length
  const avg = submitted.length ? submitted.reduce((s, a) => s + Number(a.score ?? 0), 0) / submitted.length : 0
  const stats = analyzeItems(
    exam.question_ids,
    submitted.map((a) => ({ total: Number(a.score ?? 0), points: pointsOf(a) })),
  )
  const hardest = [...stats].filter((s) => s.p != null).sort((a, b) => (a.p ?? 1) - (b.p ?? 1)).slice(0, 5)

  const rescore = async () => {
    setRescoring(true)
    await supabase.rpc('admin_rescore_exam', { p_exam_id: exam.id })
    setRescoring(false)
    state.reload()
  }

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/admin/exams" className="hover:text-brand-700">
          ชุดสอบ
        </Link>
        {' / '}ผลสอบ
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">{exam.title}</h1>
          <p className="text-sm text-slate-500">
            ส่งแล้ว {submitted.length} คน · เฉลี่ย {avg.toFixed(2)} / {max}
          </p>
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
          <Button variant="secondary" loading={rescoring} loadingText="กำลังตรวจใหม่…" onClick={() => void rescore()}>
            ↻ ตรวจใหม่ทั้งชุด (หลังแก้เฉลย)
          </Button>
        </div>
      </div>

      {pair && <PrePostCompare kind={exam.kind} current={attempts} pair={pair} students={data.students} inRoom={inRoom} />}

      <section className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
        {attempts.filter((a) => inRoom(a.student_id)).length === 0 ? (
          <div className="p-4">
            <EmptyBlock>ยังไม่มีนักเรียนทำชุดนี้</EmptyBlock>
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-brand-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">นักเรียน</th>
                <th className="px-3 py-2 font-medium">ครั้งที่</th>
                <th className="px-3 py-2 font-medium">คะแนน</th>
                <th className="px-3 py-2 font-medium">สลับแท็บ</th>
                <th className="px-3 py-2 font-medium">ส่งเมื่อ</th>
                <th className="px-3 py-2 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {attempts
                .filter((a) => inRoom(a.student_id))
                .map((a) => {
                  const s = studentById.get(a.student_id)
                  return (
                    <AttemptRow
                      key={a.id}
                      attempt={a}
                      student={s}
                      open={openAttempt === a.id}
                      onToggle={() => setOpenAttempt(openAttempt === a.id ? null : a.id)}
                      questions={exam.question_ids.map((id) => qById.get(id)).filter((q): q is QuestionRow => !!q)}
                      onChanged={state.reload}
                    />
                  )
                })}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
        <h2 className="text-lg text-brand-900">วิเคราะห์ข้อสอบ</h2>
        <p className="mb-3 text-xs text-slate-500">
          p = สัดส่วนคนตอบถูก (0.2–0.8 กำลังดี) · r = อำนาจจำแนก จากกลุ่มสูง-ต่ำ 27% (≥ 0.2 ใช้ได้, ≥ 0.4 ดี) · ต้องมีผู้สอบอย่างน้อย 4 คนจึงคำนวณ r
        </p>
        {hardest.length > 0 && (
          <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
            ข้อที่ตอบผิดมากที่สุด: {hardest.map((h) => `ข้อ ${exam.question_ids.indexOf(h.questionId) + 1} (p=${h.p})`).join(', ')}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">ข้อ</th>
                <th className="px-2 py-1 font-medium">คำถาม</th>
                <th className="px-2 py-1 font-medium">p</th>
                <th className="px-2 py-1 font-medium">ระดับ</th>
                <th className="px-2 py-1 font-medium">r</th>
                <th className="px-2 py-1 font-medium">อำนาจจำแนก</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.questionId} className="border-t border-brand-50">
                  <td className="px-2 py-1.5 font-display text-brand-600">{i + 1}</td>
                  <td className="max-w-md px-2 py-1.5">
                    <span className="line-clamp-2">{qById.get(s.questionId)?.prompt ?? '(ลบแล้ว)'}</span>
                  </td>
                  <td className="px-2 py-1.5">{s.p ?? '–'}</td>
                  <td className="px-2 py-1.5">{s.level}</td>
                  <td className="px-2 py-1.5">{s.r ?? '–'}</td>
                  <td className={`px-2 py-1.5 ${s.discrimination === 'ควรปรับปรุง' ? 'text-rose-600' : ''}`}>{s.discrimination}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function AttemptRow({
  attempt: a,
  student,
  open,
  onToggle,
  questions,
  onChanged,
}: {
  attempt: ExamAttemptRow
  student: StudentRow | undefined
  open: boolean
  onToggle: () => void
  questions: QuestionRow[]
  onChanged: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const points = pointsOf(a)
  const answers = (a.answers ?? {}) as Record<string, unknown>

  const grade = async (qid: string, p: number) => {
    setBusy(qid)
    await supabase.rpc('admin_grade_exam_answer', { p_attempt_id: a.id, p_question_id: qid, p_points: p })
    setBusy(null)
    onChanged()
  }
  const remove = async () => {
    setBusy('delete')
    await supabase.from('exam_attempts').delete().eq('id', a.id)
    setBusy(null)
    onChanged()
  }

  return (
    <>
      <tr className="border-t border-brand-50">
        <td className="px-3 py-2">
          {student ? (
            <>
              <span className="text-slate-400">{student.number ?? '-'}.</span> {fullName(student)}
            </>
          ) : (
            '—'
          )}
        </td>
        <td className="px-3 py-2">{a.attempt_no}</td>
        <td className="px-3 py-2 font-display">
          {a.submitted_at ? `${Number(a.score ?? 0)} / ${Number(a.max_points ?? 0)}` : <span className="text-sky-700">กำลังทำ</span>}
          {a.needs_review && <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs text-amber-800">รอตรวจข้อเขียน</span>}
        </td>
        <td className={`px-3 py-2 ${a.tab_switches > 2 ? 'font-display text-rose-600' : ''}`}>{a.tab_switches}</td>
        <td className="px-3 py-2 text-slate-500">{a.submitted_at ? new Date(a.submitted_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '–'}</td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={onToggle} className="rounded-lg px-2 py-1 font-display text-brand-700 hover:bg-brand-100">
              {open ? 'ซ่อน' : 'ดูคำตอบ'}
            </button>
            {confirmDelete ? (
              <>
                <button type="button" disabled={busy !== null} onClick={() => void remove()} className="rounded-lg bg-rose-100 px-2 py-1 text-rose-700">
                  {busy === 'delete' ? 'กำลังลบ…' : 'ยืนยัน (ให้สอบใหม่)'}
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-slate-500">
                  ยกเลิก
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-brand-100">
                ลบ/ให้สอบใหม่
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="bg-brand-50/60 px-3 py-3">
            <ol className="flex flex-col gap-2">
              {questions.map((q, i) => {
                const p = points[q.id]
                return (
                  <li key={q.id} className="rounded-xl bg-white p-3 text-sm ring-1 ring-brand-100">
                    <div className="flex justify-between gap-2">
                      <span className="font-display">
                        {i + 1}. {q.prompt}
                      </span>
                      <span className={p == null ? 'text-amber-700' : p >= 1 ? 'text-emerald-700' : 'text-rose-600'}>{p == null ? 'รอตรวจ' : p}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">ตอบ: {describeAnswer(q, answers[q.id] ?? null)}</p>
                    {q.type === 'short' && a.submitted_at && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">ให้คะแนน:</span>
                        {[0, 0.5, 1].map((v) => (
                          <button
                            key={v}
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void grade(q.id, v)}
                            className={`rounded-lg px-3 py-1 font-display ring-1 ${p === v ? 'bg-brand-600 text-white ring-brand-600' : 'ring-brand-200 hover:bg-brand-100'}`}
                          >
                            {busy === q.id ? '…' : v}
                          </button>
                        ))}
                        {q.explanation && <span className="text-xs text-slate-500">แนว: {q.explanation}</span>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </td>
        </tr>
      )}
    </>
  )
}

function PrePostCompare({
  kind,
  current,
  pair,
  students,
  inRoom,
}: {
  kind: string
  current: ExamAttemptRow[]
  pair: { title: string; kind: string | null; attempts: ExamAttemptRow[] }
  students: StudentRow[]
  inRoom: (sid: string) => boolean
}) {
  const pre = kind === 'pretest' ? current : pair.attempts
  const post = kind === 'pretest' ? pair.attempts : current
  const best = (list: ExamAttemptRow[], sid: string) => {
    const s = list.filter((a) => a.student_id === sid && a.submitted_at && a.max_points)
    return s.length ? Math.max(...s.map((a) => (Number(a.score) / Number(a.max_points)) * 100)) : null
  }
  const rows = students
    .filter((s) => inRoom(s.id))
    .map((s) => ({ s, pre: best(pre, s.id), post: best(post, s.id) }))
    .filter((r) => r.pre != null || r.post != null)
  const both = rows.filter((r) => r.pre != null && r.post != null)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const preAvg = mean(both.map((r) => r.pre as number))
  const postAvg = mean(both.map((r) => r.post as number))

  return (
    <section className="rounded-3xl bg-gradient-to-br from-mint-400/15 to-sky2-400/15 p-4 ring-1 ring-mint-400/40 sm:p-6">
      <h2 className="text-lg text-brand-900">เทียบก่อนเรียน–หลังเรียน</h2>
      {both.length === 0 ? (
        <p className="text-sm text-slate-600">ยังไม่มีนักเรียนที่ทำครบทั้งสองชุด</p>
      ) : (
        <>
          <p className="mt-1 text-slate-700">
            {both.length} คนที่ทำครบ · เฉลี่ยก่อนเรียน <b>{preAvg?.toFixed(1)}%</b> → หลังเรียน <b>{postAvg?.toFixed(1)}%</b>{' '}
            <span className="font-display text-emerald-700">({((postAvg ?? 0) - (preAvg ?? 0)).toFixed(1)} %)</span>
          </p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {both.map((r) => (
              <li key={r.s.id} className="flex justify-between rounded-lg bg-white/70 px-2 py-1">
                <span>
                  {r.s.number}. {r.s.nickname || r.s.first_name}
                </span>
                <span className="font-display">
                  {(r.pre as number).toFixed(0)}% → {(r.post as number).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
