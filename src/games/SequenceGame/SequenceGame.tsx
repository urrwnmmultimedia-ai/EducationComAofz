import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { gradeMatch, gradeSequence, scrambled, type Graded } from '@/games/shared/logic'
import type { SequenceConfig } from '@/games/shared/schemas'
import type { GameProps } from '@/games/shared/types'
import { useCountdown } from '@/games/shared/useGameTimer'

// เกมเรียงลำดับ (+ จับคู่สถานการณ์): Process Puzzle, Report Order
export function SequenceGame({ config, onFinish, sfx }: GameProps<SequenceConfig>) {
  const initial = useMemo(() => scrambled(config.items.length), [config.items.length])
  const [order, setOrder] = useState(initial)
  const [first, setFirst] = useState<Graded | null>(null)
  const [chosen, setChosen] = useState<(number | null)[]>(() => (config.match ?? []).map(() => null))
  const hasMatch = (config.match ?? []).length > 0

  const checkOrder = () => {
    const g = gradeSequence(config, order)
    if (g.correct === g.total) sfx.correct()
    else sfx.wrong()
    if (!hasMatch) onFinish(g)
    else setFirst(g)
  }
  const left = useCountdown(config.timeLimitSec, () => (first ? finishMatch() : checkOrder()), first ? 'match' : 'order')

  const finishMatch = () => {
    if (!first) return
    const m = gradeMatch(config, chosen)
    onFinish({ correct: first.correct + m.correct, total: first.total + m.total, mistakes: [...first.mistakes, ...m.mistakes] })
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return
    const next = [...order]
    ;[next[from], next[to]] = [next[to] as number, next[from] as number]
    setOrder(next)
  }

  if (first) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-display text-brand-900">
          ด่าน 2: สถานการณ์นี้อยู่ขั้นตอนใด {left != null && <span className="text-sm text-slate-500">⏱ {left}</span>}
        </p>
        <ul className="flex flex-col gap-3">
          {(config.match ?? []).map((m, i) => (
            <li key={m.situation} className="grid gap-2 rounded-2xl bg-brand-50 p-3 sm:grid-cols-2 sm:items-center">
              <span>{m.situation}</span>
              <select
                className="rounded-xl border-2 border-brand-200 bg-white px-3 py-2"
                aria-label={`ขั้นตอนของ ${m.situation}`}
                value={chosen[i] ?? ''}
                onChange={(e) => setChosen(chosen.map((c, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : c)))}
              >
                <option value="">— เลือกขั้นตอน —</option>
                {config.items.map((it, k) => (
                  <option key={it} value={k}>
                    {k + 1}. {it}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <Button className="self-end" onClick={finishMatch}>
          ✓ ส่งคำตอบ
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        ใช้ปุ่ม ↑ ↓ เรียงจากบนลงล่าง {left != null && <span className="font-display">· ⏱ {left}</span>}
      </p>
      <ol className="flex flex-col gap-2">
        {order.map((item, pos) => (
          <motion.li layout key={item} className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-2 ring-brand-100">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 font-display text-white">{pos + 1}</span>
            <span className="flex-1 font-display text-slate-800">{config.items[item]}</span>
            <button type="button" aria-label="เลื่อนขึ้น" disabled={pos === 0} onClick={() => move(pos, pos - 1)} className="grid size-10 place-items-center rounded-xl text-lg hover:bg-brand-100 disabled:opacity-30">
              ↑
            </button>
            <button type="button" aria-label="เลื่อนลง" disabled={pos === order.length - 1} onClick={() => move(pos, pos + 1)} className="grid size-10 place-items-center rounded-xl text-lg hover:bg-brand-100 disabled:opacity-30">
              ↓
            </button>
          </motion.li>
        ))}
      </ol>
      <Button className="self-end" onClick={checkOrder}>
        ✓ ตรวจลำดับ
      </Button>
    </div>
  )
}
