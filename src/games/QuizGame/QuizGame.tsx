import { useState } from 'react'
import { gradeQuizAnswer } from '@/games/shared/logic'
import { QuizCard } from '@/games/shared/QuizCard'
import type { QuizConfig } from '@/games/shared/schemas'
import type { GameProps, Mistake } from '@/games/shared/types'

// เกมตอบคำถาม: อุ่นเครื่อง, Fix the Bug
export function QuizGame({ config, onFinish, sfx }: GameProps<QuizConfig>) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const item = config.questions[index]
  if (!item) return null

  return (
    <QuizCard
      key={index}
      item={item}
      index={index}
      total={config.questions.length}
      timeSec={config.timePerQuestionSec}
      onAnswered={(chosen) => {
        const r = gradeQuizAnswer(item, chosen)
        if (r.ok) sfx.correct()
        else sfx.wrong()
        const c = correct + (r.ok ? 1 : 0)
        const m = r.mistake ? [...mistakes, r.mistake] : mistakes
        if (index + 1 >= config.questions.length) onFinish({ correct: c, total: config.questions.length, mistakes: m })
        else {
          setCorrect(c)
          setMistakes(m)
          setIndex(index + 1)
        }
      }}
    />
  )
}
