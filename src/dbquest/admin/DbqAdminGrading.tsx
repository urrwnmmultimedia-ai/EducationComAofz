import { useState } from 'react'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { course } from '@/content/course'
import { useAsync } from '@/lib/useAsync'
import { btn, displayName, formatDateTime, input, PageHeader, panel, RoomSelect } from './adminUi'
import { fetchSubmissions, gradeSubmission, type Submission } from './dbqAdminApi'
import { parseScoreInput } from './gradebookModel'

type Status = 'pending' | 'graded' | 'all'

// ตรวจใบงาน: เห็นเกณฑ์ (rubric) + คำตอบตัวอย่าง ให้คะแนน + คอมเมนต์ ยกเลิกการตรวจได้
export function DbqAdminGrading() {
  const [status, setStatus] = useState<Status>('pending')
  const [room, setRoom] = useState<string | null>(null)
  const [session, setSession] = useState<number | null>(null)
  const res = useAsync(
    () => fetchSubmissions({ status, ...(room ? { classroom_id: room } : {}), ...(session ? { session_no: session } : {}) }),
    [status, room, session],
  )

  return (
    <div className="space-y-4">
      <PageHeader title="ตรวจงาน">
        <select className={input} aria-label="สถานะ" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="pending">รอตรวจ</option>
          <option value="graded">ตรวจแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </select>
        <RoomSelect value={room} onChange={setRoom} />
        <select className={input} aria-label="คาบ" value={session ?? ''} onChange={(e) => setSession(e.target.value ? Number(e.target.value) : null)}>
          <option value="">ทุกคาบ</option>
          {course.sessions.map((s) => (
            <option key={s.no} value={s.no}>
              คาบ {s.no}
            </option>
          ))}
        </select>
      </PageHeader>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' &&
        (res.data.length === 0 ? (
          <p className={`${panel} text-slate-500`}>{status === 'pending' ? 'ไม่มีงานรอตรวจ' : 'ไม่มีงานตามเงื่อนไขนี้'}</p>
        ) : (
          <ul className="space-y-3">
            {res.data.map((s) => (
              <li key={s.id}>
                <GradeCard sub={s} onSaved={res.reload} />
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

function GradeCard({ sub, onSaved }: { sub: Submission; onSaved: () => void }) {
  const [score, setScore] = useState(sub.score == null ? '' : String(sub.score))
  const [feedback, setFeedback] = useState(sub.feedback ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const max = sub.assignment.max_score

  const save = async (value: number | null) => {
    setBusy(true)
    setError(null)
    try {
      await gradeSubmission(sub.id, value, feedback)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }
  const onSave = () => {
    const parsed = parseScoreInput(score, max)
    if (!parsed.ok || parsed.value == null) {
      setError(`กรอกคะแนน 0–${max}`)
      return
    }
    void save(parsed.value)
  }

  return (
    <article className={`${panel} space-y-3`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-dq-900">
            {displayName(sub.student)} <span className="text-sm text-slate-500">· {sub.student.classroom_name} เลขที่ {sub.student.number ?? '-'}</span>
          </p>
          <p className="text-sm text-slate-500">
            คาบ {sub.assignment.session_no} · {sub.assignment.title} · ส่ง {formatDateTime(sub.submitted_at)}
          </p>
        </div>
        {sub.graded_at && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800">ตรวจแล้ว {sub.score}/{max}</span>}
      </header>
      <div className="whitespace-pre-wrap rounded-xl bg-dq-50 p-3">{sub.content.text || <span className="text-slate-400">(ไม่มีข้อความ)</span>}</div>

      {(sub.rubric || sub.sample) && (
        <div>
          <button type="button" className="text-sm text-dq-700 underline-offset-2 hover:underline" onClick={() => setShowKey((v) => !v)} aria-expanded={showKey}>
            {showKey ? 'ซ่อนเกณฑ์และคำตอบตัวอย่าง' : 'ดูเกณฑ์และคำตอบตัวอย่าง'}
          </button>
          {showKey && (
            <div className="mt-2 grid gap-3 rounded-xl bg-amber-50 p-3 text-sm md:grid-cols-2">
              {sub.rubric && (
                <ul className="space-y-1">
                  {sub.rubric.map((r, i) => (
                    <li key={i}>
                      • {r.criterion} <span className="font-display">({r.points})</span>
                    </li>
                  ))}
                </ul>
              )}
              {sub.sample && <p className="whitespace-pre-wrap text-slate-700">{sub.sample}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block text-slate-500">คะแนน (เต็ม {max})</span>
          <input className={`${input} w-24`} inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <label className="min-w-48 flex-1 text-sm">
          <span className="block text-slate-500">คอมเมนต์ถึงนักเรียน</span>
          <input className={`${input} w-full`} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        <button type="button" className={btn.primary} disabled={busy} onClick={onSave}>
          {busy ? 'กำลังบันทึก…' : sub.graded_at ? 'แก้คะแนน' : 'บันทึกคะแนน'}
        </button>
        {sub.graded_at && (
          <button type="button" className={btn.danger} disabled={busy} onClick={() => void save(null)} title="นักเรียนจะแก้แล้วส่งใหม่ได้">
            ยกเลิกการตรวจ
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </article>
  )
}
