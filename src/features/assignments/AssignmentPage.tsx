import { useRef } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { AssignmentRow, SubmissionRow } from '@/lib/database.types'
import { useAsync } from '@/lib/useAsync'
import { isLate } from '@/lib/scoring'
import { Markdown } from '@/features/lessons/Markdown'
import { dueCountdown } from '@/features/student/studentApi'
import { parseRubric } from './assignmentModel'
import { fetchAssignmentForStudent } from './assignmentsApi'
import { FileList } from './SubmissionView'
import { useAssignmentForm } from './useAssignmentForm'

const STATUS_LABEL: Record<SubmissionRow['status'], { text: string; cls: string }> = {
  draft: { text: 'ฉบับร่าง', cls: 'bg-slate-100 text-slate-700' },
  submitted: { text: 'ส่งแล้ว รอครูตรวจ', cls: 'bg-sky-100 text-sky-800' },
  returned: { text: 'ครูส่งคืนให้แก้', cls: 'bg-amber-100 text-amber-800' },
  graded: { text: 'ตรวจแล้ว', cls: 'bg-emerald-100 text-emerald-800' },
}

const INPUT = 'w-full rounded-xl border-2 border-brand-100 bg-white px-3 py-2 outline-none focus:border-brand-500 disabled:bg-slate-50'

export function AssignmentPage() {
  const id = useParams().id ?? ''
  const { identity } = useAuth()
  const studentId = identity.student?.id ?? ''
  const state = useAsync(() => fetchAssignmentForStudent(id, studentId), [id, studentId])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  if (!state.data) return <ErrorBlock message="ไม่พบงานนี้ หรือคาบของงานยังไม่เปิด" />
  return <AssignmentForm key={state.data.assignment.id} assignment={state.data.assignment} initial={state.data.submission} studentId={studentId} />
}

function AssignmentForm({ assignment, initial, studentId }: { assignment: AssignmentRow; initial: SubmissionRow | null; studentId: string }) {
  const f = useAssignmentForm(assignment, studentId, initial)
  const fileInput = useRef<HTMLInputElement>(null)
  const rubric = parseRubric(assignment.rubric)
  const sub = f.submission
  const late = sub?.submitted_at ? isLate({ dueAt: assignment.due_at }, { submittedAt: sub.submitted_at }) : false
  const scoreOnly = assignment.type === 'score_only'
  const due = dueCountdown(assignment.due_at)

  return (
    <div className="flex flex-col gap-5">
      <nav className="text-sm text-slate-500">
        <Link to="/home" className="hover:text-brand-700">
          หน้าหลัก
        </Link>
        {assignment.session_no && (
          <>
            {' / '}
            <Link to={`/sessions/${assignment.session_no}?step=work`} className="hover:text-brand-700">
              คาบที่ {assignment.session_no}
            </Link>
          </>
        )}
        {' / '}งาน
      </nav>

      <header className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-100 px-3 py-0.5 text-brand-700">คะแนนเต็ม {Number(assignment.max_score)}</span>
          {!scoreOnly && (
            <span className={`rounded-full px-3 py-0.5 ${due.startsWith('เลย') ? 'bg-rose-100 text-rose-700' : 'bg-sun-300/50 text-amber-900'}`}>
              {assignment.due_at ? `ส่งภายใน ${new Date(assignment.due_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} (${due})` : due}
            </span>
          )}
          {sub && <span className={`rounded-full px-3 py-0.5 ${STATUS_LABEL[sub.status].cls}`}>{STATUS_LABEL[sub.status].text}</span>}
          {late && <span className="rounded-full bg-rose-100 px-3 py-0.5 text-rose-700">ส่งช้า</span>}
        </div>
        <h1 className="mt-2 text-2xl text-brand-900">{assignment.title}</h1>
        {assignment.instructions_md && (
          <div className="mt-2">
            <Markdown text={assignment.instructions_md} />
          </div>
        )}
        {rubric.length > 0 && (
          <details className="mt-3 rounded-2xl bg-brand-50 p-3">
            <summary className="cursor-pointer font-display text-brand-700">เกณฑ์การให้คะแนน</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {rubric.map((r) => (
                <li key={r.criterion} className="flex justify-between gap-3">
                  <span>{r.criterion}</span>
                  <span className="shrink-0 font-display">{r.points} คะแนน</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </header>

      {sub && (sub.status === 'graded' || sub.status === 'returned') && (
        <section className={`rounded-3xl p-5 ring-1 ${sub.status === 'graded' ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
          {sub.status === 'graded' && (
            <p className="font-display text-2xl text-emerald-800">
              ได้ {Number(sub.score)} / {Number(assignment.max_score)} คะแนน
            </p>
          )}
          {sub.status === 'returned' && <p className="font-display text-amber-900">ครูส่งงานคืนให้แก้ไข แก้แล้วกดส่งอีกครั้งนะ</p>}
          {sub.feedback && <p className="mt-2 whitespace-pre-wrap text-slate-700">💬 ครู: {sub.feedback}</p>}
        </section>
      )}

      {scoreOnly ? (
        <section className="rounded-3xl bg-white p-5 text-slate-600 ring-1 ring-brand-100">
          รายการนี้เป็นคะแนนจากการสอบหรือครูให้คะแนนในห้อง ไม่ต้องส่งงานในเว็บ
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7">
          <h2 className="text-lg text-brand-900">คำตอบของฉัน</h2>

          {assignment.type === 'text' && (
            <textarea
              className={`${INPUT} min-h-48`}
              aria-label="คำตอบ"
              disabled={f.locked}
              value={f.content.text ?? ''}
              onChange={(e) => f.update({ text: e.target.value })}
              placeholder="พิมพ์คำตอบที่นี่…"
            />
          )}

          {assignment.type === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr>
                    {f.tableConfig.columns.map((c) => (
                      <th key={c} className="px-1 pb-2 text-left font-display font-medium text-brand-900">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(f.content.rows ?? []).map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="p-1 align-top">
                          <textarea
                            rows={2}
                            className={INPUT}
                            aria-label={`${f.tableConfig.columns[c] ?? ''} แถว ${r + 1}`}
                            disabled={f.locked}
                            value={cell}
                            onChange={(e) =>
                              f.update({
                                rows: (f.content.rows ?? []).map((rr, ri) =>
                                  ri === r ? rr.map((cc, ci) => (ci === c ? e.target.value : cc)) : rr,
                                ),
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!f.locked && (
                <button
                  type="button"
                  className="mt-2 text-sm text-brand-700 underline underline-offset-4"
                  onClick={() => f.update({ rows: [...(f.content.rows ?? []), f.tableConfig.columns.map(() => '')] })}
                >
                  + เพิ่มแถว
                </button>
              )}
            </div>
          )}

          {assignment.type === 'link' && (
            <input
              className={INPUT}
              type="url"
              inputMode="url"
              aria-label="ลิงก์งาน"
              placeholder="https://…"
              disabled={f.locked}
              value={f.content.url ?? ''}
              onChange={(e) => f.update({ url: e.target.value })}
            />
          )}

          {assignment.type === 'file' && (
            <div className="flex flex-col gap-3">
              {f.files.length > 0 && <FileList paths={f.files} urls={f.fileUrls} onRemove={f.locked ? undefined : (p) => void f.removeFile(p)} disabled={f.busy} />}
              {!f.locked && (
                <div className="rounded-2xl border-2 border-dashed border-brand-200 p-4 text-center">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files) void f.addFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  <Button variant="secondary" loading={f.uploading} loadingText="กำลังอัปโหลด…" onClick={() => fileInput.current?.click()}>
                    📎 เลือกรูปหรือไฟล์ PDF
                  </Button>
                  <p className="mt-2 text-xs text-slate-500">ไฟล์ละไม่เกิน 10 MB · ถ่ายรูปจากมือถือได้เลย</p>
                </div>
              )}
            </div>
          )}

          {(assignment.type === 'file' || assignment.type === 'link') && (
            <textarea
              className={INPUT}
              rows={3}
              aria-label="หมายเหตุถึงครู"
              placeholder="หมายเหตุ / คำอธิบายเพิ่มเติม (ไม่บังคับ)"
              disabled={f.locked}
              value={f.content.text ?? ''}
              onChange={(e) => f.update({ text: e.target.value })}
            />
          )}

          {!f.locked && (
            <div className="flex flex-wrap items-center gap-3">
              <Button loading={f.status === 'saving'} disabled={f.busy} onClick={() => void f.save('submitted')}>
                {sub?.status === 'submitted' ? 'ส่งงานอีกครั้ง (อัปเดต)' : 'ส่งงาน'}
              </Button>
              {sub?.status !== 'submitted' && (
                <Button variant="secondary" disabled={f.busy} onClick={() => void f.save('draft')}>
                  บันทึกฉบับร่าง
                </Button>
              )}
              {f.message && (
                <span role="status" className={f.status === 'error' ? 'text-rose-600' : 'text-mint-500'}>
                  {f.message}
                </span>
              )}
            </div>
          )}
          {!f.locked && <p className="text-xs text-slate-500">ส่งตรงเวลาครั้งแรกได้ +30 XP · แก้ไขได้จนกว่าครูจะตรวจ</p>}
        </section>
      )}
    </div>
  )
}
