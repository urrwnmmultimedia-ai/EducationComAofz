import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/Button'
import type { QuizItem } from './schemas'
import { useCountdown } from './useGameTimer'

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

// คำถาม 1 ข้อ: เลือกแล้วเฉลยทันที (เขียว/แดง) แล้วกดไปต่อ — ใช้ร่วมกันในหลายเกม
export function QuizCard({
  item,
  index,
  total,
  timeSec,
  onAnswered,
}: {
  item: QuizItem
  index: number
  total: number
  timeSec?: number
  onAnswered: (chosen: number | null) => void
}) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const left = useCountdown(timeSec, () => {
    if (!locked) {
      setLocked(true)
      setChosen(null)
    }
  }, index, locked)

  const pick = (i: number) => {
    if (locked) return
    setChosen(i)
    setLocked(true)
  }

  return (
    <motion.div key={index} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          ข้อ {index + 1} / {total}
        </span>
        {left != null && !locked && <span className={`font-display tabular-nums ${left <= 5 ? 'text-rose-600' : ''}`}>⏱ {left}</span>}
      </div>
      <p className="font-display text-xl text-slate-800">{item.q}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {item.choices.map((c, i) => {
          const state = !locked ? 'idle' : i === item.answer ? 'right' : i === chosen ? 'wrong' : 'dim'
          return (
            <button
              key={c}
              type="button"
              disabled={locked}
              onClick={() => pick(i)}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition ${
                state === 'right'
                  ? 'bg-mint-500 text-white ring-mint-500'
                  : state === 'wrong'
                    ? 'bg-coral-400 text-white ring-coral-400'
                    : state === 'dim'
                      ? 'bg-white opacity-60 ring-brand-100'
                      : 'bg-white ring-brand-100 hover:-translate-y-0.5 hover:ring-brand-400'
              }`}
            >
              <span className="font-display">{LETTERS[i]}</span>
              <span>{c}</span>
            </button>
          )
        })}
      </div>
      {locked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-3">
          <p className="text-sm text-slate-700">
            {chosen === item.answer ? '✅ ถูกต้อง!' : chosen == null ? '⏰ หมดเวลา' : '❌ ยังไม่ถูก'} {item.explain && <span className="text-slate-500">— {item.explain}</span>}
          </p>
          <Button onClick={() => onAnswered(chosen)}>{index + 1 < total ? 'ข้อต่อไป →' : 'ไปต่อ →'}</Button>
        </div>
      )}
    </motion.div>
  )
}
