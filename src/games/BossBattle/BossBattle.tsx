import { useState } from 'react'
import { motion } from 'framer-motion'
import { bossAnswer, bossInit, gradeQuizAnswer } from '@/games/shared/logic'
import { QuizCard } from '@/games/shared/QuizCard'
import type { BossConfig } from '@/games/shared/schemas'
import type { GameProps, Mistake } from '@/games/shared/types'

// Boss Battle หน่วย 1–3 และ Final Quest (หลายด่าน)
export function BossBattle({ config, onFinish, sfx }: GameProps<BossConfig>) {
  const sizes = config.stages.map((s) => s.questions.length)
  const total = sizes.reduce((a, b) => a + b, 0)
  const [state, setState] = useState(() => bossInit(config.hearts))
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [hit, setHit] = useState(0) // นับเพื่อเล่นแอนิเมชันโดนตี
  const [hurt, setHurt] = useState(0)
  const stage = config.stages[state.stage]
  const item = stage?.questions[state.index]
  if (!stage || !item) return null

  const onAnswered = (chosen: number | null) => {
    const r = gradeQuizAnswer(item, chosen)
    if (r.ok) {
      sfx.correct()
      setHit((h) => h + 1)
    } else {
      sfx.wrong()
      setHurt((h) => h + 1)
    }
    const next = bossAnswer(state, r.ok, sizes)
    const m = r.mistake ? [...mistakes, r.mistake] : mistakes
    if (next.over) {
      // แพ้กลางทาง: ข้อที่ยังไม่ได้ตอบนับเป็นไม่ได้คะแนน (total = ทั้งหมด)
      onFinish({ correct: next.correct, total, mistakes: m })
      return
    }
    setMistakes(m)
    setState(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {config.stages.length > 1 && (
        <p className="text-center font-display text-brand-700">
          {stage.name} ({state.stage + 1}/{config.stages.length})
        </p>
      )}
      <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-r from-slate-800 to-brand-900 p-4 text-white">
        <motion.span key={`boss-${hit}`} animate={hit ? { x: [0, -10, 10, -6, 6, 0], rotate: [0, -8, 8, 0] } : {}} transition={{ duration: 0.4 }} className="text-6xl" aria-hidden>
          {stage.emoji}
        </motion.span>
        <div className="flex-1">
          <p className="font-display">{stage.name}</p>
          <div className="mt-1 h-4 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="พลังบอส" aria-valuenow={Math.round(state.bossHp * 100)} aria-valuemin={0} aria-valuemax={100}>
            <motion.div className="h-full bg-gradient-to-r from-coral-400 to-rose-600" animate={{ width: `${state.bossHp * 100}%` }} transition={{ duration: 0.4 }} />
          </div>
          <motion.p key={`hp-${hurt}`} animate={hurt ? { scale: [1, 1.3, 1] } : {}} className="mt-2 text-xl" aria-label={`หัวใจเหลือ ${state.hearts}`}>
            {'❤️'.repeat(state.hearts)}
            {'🤍'.repeat(Math.max(0, config.hearts - state.hearts))}
          </motion.p>
        </div>
      </div>
      <QuizCard
        key={`${state.stage}-${state.index}`}
        item={item}
        index={state.index}
        total={stage.questions.length}
        timeSec={config.timePerQuestionSec}
        onAnswered={onAnswered}
      />
    </div>
  )
}
