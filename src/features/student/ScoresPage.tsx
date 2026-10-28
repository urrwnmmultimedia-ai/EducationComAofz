import { Link } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import type { AssignmentRow } from '@/lib/database.types'
import { formatGrade } from '@/lib/grade'
import { CATEGORY_LABELS, computeStudentScore, effectiveScore, isLate, type Category } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import { fetchMyGradebook } from '@/features/assignments/assignmentsApi'
import { entriesFor, fetchSettings, policyFromSettings, sortAssignments, toScoredItems } from '@/features/assignments/gradebookData'

export function ScoresPage() {
  const { identity } = useAuth()
  const studentId = identity.student?.id ?? ''
  const state = useAsync(async () => {
    const [book, settings] = await Promise.all([fetchMyGradebook(studentId), fetchSettings()])
    return { ...book, policy: policyFromSettings(settings) }
  }, [studentId])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />

  const { submissions, totalXp, policy } = state.data
  // RPC คืนเฉพาะคอลัมน์ที่จำเป็น เติมค่าที่เหลือให้ครบชนิด
  const assignments = sortAssignments(
    state.data.assignments.map((a) => ({ ...a, unit_id: null, instructions_md: '', rubric: [], config: {}, created_at: '' }) as AssignmentRow),
  )
  const entries = entriesFor(studentId, submissions)
  const score = computeStudentScore(toScoredItems(assignments), entries, policy, totalXp)
  const subByAssignment = new Map(submissions.map((s) => [s.assignment_id, s]))

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl text-ink">สมุดคะแนนของฉัน</h1>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
          <p className="text-sm text-slate-500">คะแนนรวมตอนนี้ (จาก 100)</p>
          <p className="font-display text-4xl text-brand-700">{score.total}</p>
          <p className="text-slate-600">เกรดถ้าจบเทอมตอนนี้: {formatGrade(score.grade)}</p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-mint-400/20 to-sky2-400/20 p-5 ring-1 ring-mint-400/50">
          <p className="text-sm text-slate-600">เกรดคาดการณ์ (ถ้าทำได้แบบนี้ต่อไป)</p>
          <p className="font-display text-4xl text-emerald-800">{score.predictedGrade == null ? '–' : formatGrade(score.predictedGrade)}</p>
          <p className="text-slate-600">
            {score.predictedTotal == null ? 'ยังไม่มีงานที่ครูตรวจ' : `คาดว่าได้ประมาณ ${score.predictedTotal} คะแนน`}
          </p>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
        <h2 className="mb-3 text-lg text-brand-900">แยกตามประเภท</h2>
        <ul className="flex flex-col gap-3">
          {score.categories.map((c) => (
            <li key={c.category}>
              <div className="flex justify-between text-sm">
                <span>{CATEGORY_LABELS[c.category]}</span>
                <span className="font-display">
                  {c.scaled} / {c.weight}
                </span>
              </div>
              <ProgressBar value={c.weight ? (c.scaled / c.weight) * 100 : 0} className="mt-1" />
            </li>
          ))}
        </ul>
      </section>

      {(['work', 'project', 'unit_test', 'midterm', 'final'] as Category[]).map((cat) => {
        const list = assignments.filter((a) => a.category === cat)
        if (list.length === 0) return null
        return (
          <section key={cat} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
            <h2 className="mb-2 text-lg text-brand-900">{CATEGORY_LABELS[cat]}</h2>
            <ul className="divide-y divide-brand-50">
              {list.map((a) => {
                const sub = subByAssignment.get(a.id)
                const entry = entries.get(a.id)
                const item = { id: a.id, category: a.category, maxScore: Number(a.max_score), dueAt: a.due_at }
                const eff = effectiveScore(item, entry, policy)
                const late = entry ? isLate(item, entry) : false
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0">
                      {a.type !== 'score_only' ? (
                        <Link to={`/assignments/${a.id}`} className="hover:text-brand-700 hover:underline">
                          {a.title}
                        </Link>
                      ) : (
                        a.title
                      )}
                      {a.session_no && <span className="ml-2 text-xs text-slate-400">คาบ {a.session_no}</span>}
                    </span>
                    <span className="flex items-center gap-2 text-sm">
                      {late && policy.latePenaltyEnabled && eff != null && (
                        <span className="rounded-full bg-rose-100 px-2 text-rose-700">ส่งช้า −{policy.latePenaltyPct}%</span>
                      )}
                      {sub?.status === 'returned' && <span className="rounded-full bg-amber-100 px-2 text-amber-800">ส่งคืนให้แก้</span>}
                      {sub?.status === 'submitted' && <span className="rounded-full bg-sky-100 px-2 text-sky-800">รอตรวจ</span>}
                      <span className="font-display">
                        {eff ?? '–'} / {Number(a.max_score)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
