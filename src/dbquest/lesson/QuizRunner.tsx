import { useEffect, useState, type CSSProperties } from 'react'
import type { Question } from '@/content/lesson'
import type { CheckResult } from './dbqLessonApi'
import { QuestionCard } from './QuestionCard'

const NEXT_DELAY = { right: 1400, wrong: 2600 }

interface Props {
  questions: Question[]
  solved: Set<string>
  attempted: Set<string>
  onChecked: (id: string, r: CheckResult) => void
}

// ทำคำถามทีละข้อ: ตอบแล้วรู้ทันทีว่าถูก/ผิด แล้วไปข้อถัดไปเอง · ข้อที่ผิดกดเลขข้อกลับมาตอบใหม่ได้
export function QuizRunner({ questions, solved, attempted, onChecked }: Props) {
  const total = questions.length
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !attempted.has(q.id))))
  const [advance, setAdvance] = useState<{ from: number; ms: number } | null>(null)

  useEffect(() => {
    if (!advance) return
    const t = setTimeout(() => {
      setAdvance(null)
      setIndex((i) => (i === advance.from && i < total - 1 ? i + 1 : i))
    }, advance.ms)
    return () => clearTimeout(t)
  }, [advance, total])

  const q = questions[Math.min(index, total - 1)]
  if (!q) return null
  const i = questions.indexOf(q)
  const tried = questions.filter((x) => attempted.has(x.id)).length
  const right = questions.filter((x) => solved.has(x.id)).length

  const onCardChecked = (id: string, r: CheckResult) => {
    onChecked(id, r)
    if (i < total - 1) setAdvance({ from: i, ms: r.correct ? NEXT_DELAY.right : NEXT_DELAY.wrong })
  }
  const go = (n: number) => {
    setAdvance(null)
    setIndex(n)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface shadow-[inset_0_1px_3px_rgb(20_45_100/0.18)] dark:bg-dq-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-action to-gold-400 transition-[width] duration-500"
            style={{ width: `${(tried / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-2 dark:text-dq-300">
          ข้อ {i + 1}/{total} · ถูก {right}
        </span>
      </div>

      <div key={q.id} className="tq-verdict">
        <QuestionCard question={q} solved={solved.has(q.id)} onChecked={onCardChecked} />
      </div>

      {advance && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-dq-300" aria-live="polite">
          <span>ไปข้อถัดไป</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-dq-800">
            <span
              key={`${advance.from}-${advance.ms}`}
              className="tq-countdown block h-full rounded-full bg-action"
              style={{ '--tq-countdown': `${advance.ms}ms` } as CSSProperties}
            />
          </span>
        </div>
      )}

      <nav aria-label="เลือกข้อ" className="flex flex-wrap gap-2">
        {questions.map((x, n) => {
          const ok = solved.has(x.id)
          const bad = !ok && attempted.has(x.id)
          const tone =
            n === i
              ? 'bg-gradient-to-b from-action to-action-strong text-white shadow-action'
              : ok
                ? 'bg-mint-400/30 text-emerald-900 ring-1 ring-mint-500 dark:text-emerald-200'
                : bad
                  ? 'bg-rose-100 text-rose-800 ring-1 ring-coral-400 dark:bg-rose-950/60 dark:text-rose-200'
                  : 'bg-white text-slate-500 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800'
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => go(n)}
              aria-current={n === i ? 'step' : undefined}
              aria-label={`ข้อ ${n + 1}${ok ? ' ถูก' : bad ? ' ยังไม่ถูก' : ''}`}
              className={`tq-press size-11 rounded-xl font-display shadow-sm ${tone}`}
            >
              {ok ? '✓' : bad ? '✗' : n + 1}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
