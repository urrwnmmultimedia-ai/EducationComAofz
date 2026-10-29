import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { formatGrade } from '@/lib/grade'
import { CATEGORY_LABELS, effectiveScore, isLate, type Category } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import { EvolutionCardM3, type EvoInfo } from './EvolutionCardM3'
import { fetchMyScore } from './myScore'

// สมุดคะแนนของนักเรียน (แท็บ "คะแนน" ในหน้า ฉัน)
export function ScoresPanel({ studentId, info }: { studentId: string; info?: EvoInfo }) {
  const state = useAsync(() => fetchMyScore(studentId), [studentId])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />

  const { submissions, policy, assignments, entries, score } = state.data
  const subByAssignment = new Map(submissions.map((s) => [s.assignment_id, s]))

  return (
    <div className="flex flex-col gap-5">
      <EvolutionCardM3 score={score.total} info={info} />
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-brand-50 p-5 shadow-raise ring-1 ring-brand-100">
          <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-action to-gold-400" aria-hidden />
          <p className="text-sm text-slate-500">คะแนนรวมตอนนี้ (จาก 100)</p>
          <p className="font-display text-5xl text-brand-700">{score.total}</p>
          <ProgressBar value={score.total} className="mt-2" />
          <p className="mt-2 text-slate-600">เกรดถ้าจบเทอมตอนนี้: {formatGrade(score.grade)}</p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-mint-400/20 to-sky2-400/20 p-5 shadow-raise ring-1 ring-mint-400/50">
          <p className="text-sm text-slate-600">เกรดคาดการณ์ (ถ้าทำได้แบบนี้ต่อไป)</p>
          <p className="font-display text-4xl text-emerald-800">{score.predictedGrade == null ? '–' : formatGrade(score.predictedGrade)}</p>
          <p className="text-slate-600">
            {score.predictedTotal == null ? 'ยังไม่มีงานที่ครูตรวจ' : `คาดว่าได้ประมาณ ${score.predictedTotal} คะแนน`}
          </p>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-brand-100">
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
          <section key={cat} className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-brand-100">
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
