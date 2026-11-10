import { useEffect, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import type { Question, SessionContent } from '@/content/lesson'
import type { CheckResult } from './dbqLessonApi'
import { QuestionCard } from './QuestionCard'
import { DBQ_WIDGETS, StarBurst } from './widgets'

const NEXT_DELAY = { right: 1400, wrong: 2600 }

type Level = NonNullable<SessionContent['practiceLevels']>[number]

interface Props {
  questions: Question[]
  solved: Set<string>
  attempted: Set<string>
  onChecked: (id: string, r: CheckResult) => void
  // มี = แสดงแบบด่าน (แผนที่ด่าน หัวด่าน เคล็ดลับ ตัวช่วยทบทวน คอมโบ ดาวกระจาย)
  levels?: Level[]
}

// ทำคำถามทีละข้อ: ตอบแล้วรู้ทันทีว่าถูก/ผิด แล้วไปข้อถัดไปเอง · ข้อที่ผิดกดเลขข้อกลับมาตอบใหม่ได้
export function QuizRunner({ questions, solved, attempted, onChecked, levels }: Props) {
  const total = questions.length
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((q) => !attempted.has(q.id))))
  const [advance, setAdvance] = useState<{ from: number; ms: number } | null>(null)
  const [streak, setStreak] = useState(0)
  const [burst, setBurst] = useState(0)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    if (!advance) return
    const t = setTimeout(() => {
      setAdvance(null)
      setIndex((i) => (i === advance.from && i < total - 1 ? i + 1 : i))
    }, advance.ms)
    return () => clearTimeout(t)
  }, [advance, total])
  useEffect(() => setHelp(false), [index])

  const q = questions[Math.min(index, total - 1)]
  if (!q) return null
  const i = questions.indexOf(q)
  const tried = questions.filter((x) => attempted.has(x.id)).length
  const right = questions.filter((x) => solved.has(x.id)).length
  const level = levels?.[i]
  const Helper = level?.widget ? DBQ_WIDGETS[level.widget] : undefined

  const onCardChecked = (id: string, r: CheckResult) => {
    onChecked(id, r)
    setStreak((s) => (r.correct ? s + 1 : 0))
    if (r.correct) setBurst((b) => b + 1)
    if (i < total - 1) setAdvance({ from: i, ms: r.correct ? NEXT_DELAY.right : NEXT_DELAY.wrong })
  }
  const go = (n: number) => {
    setAdvance(null)
    setIndex(n)
  }

  return (
    <div className="space-y-4">
      {levels && <LevelMap questions={questions} levels={levels} current={i} solved={solved} attempted={attempted} onGo={go} />}

      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface shadow-[inset_0_1px_3px_rgb(20_45_100/0.18)] dark:bg-dq-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-action to-gold-400 transition-[width] duration-500"
            style={{ width: `${(tried / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-2 dark:text-dq-300">
          {levels ? `⭐ ${right}/${total} ดาว` : `ข้อ ${i + 1}/${total} · ถูก ${right}`}
        </span>
        <AnimatePresence>
          {levels && streak >= 2 && (
            <motion.span
              key={streak}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="shrink-0 rounded-full bg-coral-400/15 px-2.5 py-0.5 font-display text-sm text-coral-400"
            >
              🔥 ถูกติดกัน {streak}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {level && (
        <div className="tq-banner flex items-center gap-3 rounded-2xl px-4 py-3 text-white">
          <span className="tq-orb grid size-11 shrink-0 place-items-center rounded-full text-2xl" aria-hidden>
            {level.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm opacity-85">
              ด่าน {i + 1}/{total}
            </p>
            <p className="font-display text-lg leading-tight">{level.title}</p>
            {level.tip && (
              <p className="mt-1 flex items-start gap-1.5 text-base text-db-100">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-xp-300" aria-hidden />
                {level.tip}
              </p>
            )}
          </div>
        </div>
      )}
      {Helper && (
        <div>
          <button
            type="button"
            aria-expanded={help}
            onClick={() => setHelp(!help)}
            className="tq-press min-h-10 rounded-xl bg-white px-3 font-display text-dq-700 ring-1 ring-dq-200 hover:bg-dq-50 dark:bg-dq-900 dark:text-dq-200 dark:ring-dq-700"
          >
            {help ? 'ซ่อนตัวช่วย' : '🔦 เปิดตัวช่วยทบทวนก่อนตอบ'}
          </button>
          <AnimatePresence>
            {help && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-3"
              >
                <Helper />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <motion.div
        key={q.id}
        className="relative"
        initial={levels ? { opacity: 0, rotateY: -12, x: 36 } : false}
        animate={{ opacity: 1, rotateY: 0, x: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={levels ? { transformPerspective: 1300 } : undefined}
      >
        <div className="tq-verdict">
          <QuestionCard question={q} solved={solved.has(q.id)} onChecked={onCardChecked} />
        </div>
        {levels && burst > 0 && <StarBurst key={burst} />}
      </motion.div>

      {advance && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-dq-300" aria-live="polite">
          <span>{levels ? 'ไปด่านถัดไป' : 'ไปข้อถัดไป'}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-dq-800">
            <span
              key={`${advance.from}-${advance.ms}`}
              className="tq-countdown block h-full rounded-full bg-action"
              style={{ '--tq-countdown': `${advance.ms}ms` } as CSSProperties}
            />
          </span>
        </div>
      )}

      {!levels && (
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
      )}
    </div>
  )
}

// แผนที่ด่าน: ลูกแก้วต่อกันด้วยเส้นวิ่ง ผ่านแล้วเป็นสีเขียวมีดาว ด่านปัจจุบันเรืองแสง
function LevelMap({
  questions,
  levels,
  current,
  solved,
  attempted,
  onGo,
}: {
  questions: Question[]
  levels: Level[]
  current: number
  solved: Set<string>
  attempted: Set<string>
  onGo: (n: number) => void
}) {
  return (
    <nav aria-label="แผนที่ด่าน" className="tq-raised overflow-x-auto p-4">
      <ol className="mx-auto flex w-max items-start">
        {questions.map((x, n) => {
          const lv = levels[n]
          const ok = solved.has(x.id)
          const bad = !ok && attempted.has(x.id)
          const on = n === current
          return (
            <li key={x.id} className="flex items-start">
              <button
                type="button"
                onClick={() => onGo(n)}
                aria-current={on ? 'step' : undefined}
                aria-label={`ด่าน ${n + 1} ${lv?.title ?? ''}${ok ? ' ผ่านแล้ว' : bad ? ' ยังไม่ผ่าน' : ''}`}
                className="flex w-24 flex-col items-center gap-1.5 text-center sm:w-28"
              >
                <span
                  className={`relative grid size-16 place-items-center rounded-full text-3xl transition ${
                    ok
                      ? 'bg-radial-[at_32%_28%] from-mint-400 to-mint-500 shadow-[inset_0_3px_6px_rgb(255_255_255/0.45),0_8px_16px_-6px_rgb(22_147_95/0.6)]'
                      : on
                        ? 'tq-orb tq-glow scale-110'
                        : bad
                          ? 'bg-rose-100 ring-2 ring-coral-400 dark:bg-rose-950'
                          : 'bg-white ring-2 ring-dq-200 dark:bg-dq-900 dark:ring-dq-700'
                  }`}
                >
                  <span aria-hidden>{lv?.icon ?? n + 1}</span>
                  {ok && (
                    <motion.span
                      aria-hidden
                      className="absolute -top-1 -right-1 text-xl"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      ⭐
                    </motion.span>
                  )}
                </span>
                <span className={`text-sm font-semibold ${on ? 'text-action dark:text-dq-200' : 'text-ink-2 dark:text-dq-300'}`}>ด่าน {n + 1}</span>
                <span className="text-sm leading-tight">{lv?.title}</span>
              </button>
              {n < questions.length - 1 && (
                <span aria-hidden className={`mt-8 ${ok ? 'text-mint-500' : 'text-dq-300 dark:text-dq-600'}`}>
                  <span className="tq-flow-line block h-1.5 w-8 rounded-full sm:w-16" />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
