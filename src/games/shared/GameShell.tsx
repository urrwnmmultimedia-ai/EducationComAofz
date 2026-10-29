import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Non } from '@/components/characters/Characters'
import type { GameConfig } from './schemas'
import { useSfx, type Sfx } from './sfx'
import { toScore, type GameOutcome, type GameProps } from './types'
import { useElapsed } from './useGameTimer'

export interface SubmitResult {
  xp: number
  first_play: boolean
  plays_today: number
  daily_limit: number
  capped: boolean
  best_score: number | null
  new_badges: { code: string; name: string; icon: string }[]
}

type Phase = 'intro' | 'countdown' | 'playing' | 'result'

interface Props {
  title: string
  description: string
  config: GameConfig
  Game: ComponentType<GameProps<GameConfig>>
  onSubmit: (score: number, durationSec: number) => Promise<SubmitResult>
  backTo: string
  backLabel?: string
  maxXp: number
  passScore?: number // เล่นในคาบ: ต่ำกว่านี้ยังไม่ผ่าน ต้องเล่นใหม่ก่อนไปขั้นต่อไป
  embedded?: boolean // ฝังในหน้าคาบ: ไม่มีลิงก์กลับ ผ่านแล้วหน้าคาบพาไปขั้นถัดไปเอง
}

// โครงเกมกลาง: คำอธิบาย → นับถอยหลัง 3-2-1 → เล่น → สรุปผล (คะแนน XP เฉลยข้อผิด) → เล่นอีกครั้ง
export function GameShell({ title, description, config, Game, onSubmit, backTo, backLabel = 'กลับบทเรียน', maxXp, passScore, embedded = false }: Props) {
  const sfx = useSfx()
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [outcome, setOutcome] = useState<GameOutcome | null>(null)
  const [submit, setSubmit] = useState<{ status: 'saving' | 'saved' | 'error'; result?: SubmitResult; message?: string } | null>(null)
  const elapsed = useElapsed(phase === 'playing')

  const finish = useCallback(
    async (o: GameOutcome) => {
      const duration = elapsed()
      setOutcome(o)
      setPhase('result')
      const score = toScore(o)
      if (score >= 80) sfx.win()
      setSubmit({ status: 'saving' })
      try {
        setSubmit({ status: 'saved', result: await onSubmit(score, duration) })
      } catch (e) {
        const code = e instanceof Error ? e.message : ''
        setSubmit({
          status: 'error',
          message:
            code === 'invalid_duration'
              ? 'เล่นเร็วเกินไป ระบบไม่บันทึกรอบนี้ ลองเล่นอย่างตั้งใจอีกครั้งนะ'
              : code === 'game_locked'
                ? 'เกมนี้ยังไม่เปิด (คาบยังไม่ปลดล็อก) จึงไม่ได้บันทึกคะแนน'
                : code === 'too_fast'
                  ? 'ส่งผลถี่เกินไป รอสักครู่แล้วเล่นใหม่'
                  : 'บันทึกคะแนนไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต',
        })
      }
    },
    [elapsed, onSubmit, sfx],
  )

  const again = () => {
    setOutcome(null)
    setSubmit(null)
    setRound((r) => r + 1)
    setPhase('countdown')
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        {embedded ? (
          <span />
        ) : (
          <Link to={backTo} className="text-sm text-slate-500 hover:text-brand-700">
            ← กลับ
          </Link>
        )}
        <button type="button" onClick={sfx.toggle} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-brand-100" aria-pressed={sfx.enabled}>
          {sfx.enabled ? '🔊 เสียงเปิด' : '🔇 เสียงปิด'}
        </button>
      </div>

      {phase === 'intro' && (
        <section className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-center text-white shadow-lg">
          <Non className="size-24 rounded-full bg-white/20" />
          <h1 className="text-3xl">{title}</h1>
          <p className="text-brand-100">{description}</p>
          <p className="max-w-lg rounded-2xl bg-white/10 p-3 text-sm">{config.instructions}</p>
          <p className="text-sm text-brand-100">ได้สูงสุด {maxXp} XP ในรอบแรก · รอบต่อไป 20% · วันละ 3 รอบ</p>
          <Button className="mt-2 bg-sun-400 text-amber-950 hover:bg-sun-300" onClick={() => setPhase('countdown')}>
            ▶ เริ่มเล่น
          </Button>
        </section>
      )}

      {phase === 'countdown' && <Countdown sfx={sfx} onDone={() => setPhase('playing')} />}

      {phase === 'playing' && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
          <Game key={round} config={config} onFinish={(o) => void finish(o)} sfx={sfx} />
        </section>
      )}

      {phase === 'result' && outcome && (
        <ResultScreen
          outcome={outcome}
          submit={submit}
          onAgain={again}
          backTo={backTo}
          backLabel={backLabel}
          passScore={passScore}
          embedded={embedded}
        />
      )}
    </div>
  )
}

function Countdown({ sfx, onDone }: { sfx: Sfx; onDone: () => void }) {
  const [n, setN] = useState(3)
  const latest = useRef({ sfx, onDone })
  latest.current = { sfx, onDone }
  useEffect(() => {
    if (n === 0) {
      latest.current.onDone()
      return
    }
    latest.current.sfx.tick()
    const id = setTimeout(() => setN(n - 1), 800)
    return () => clearTimeout(id)
  }, [n])
  return (
    <div className="grid h-64 place-items-center rounded-3xl bg-white ring-1 ring-brand-100" aria-live="assertive">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="font-display text-8xl text-brand-600"
        >
          {n > 0 ? n : 'Go!'}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

function ResultScreen({
  outcome,
  submit,
  onAgain,
  backTo,
  backLabel,
  passScore,
  embedded,
}: {
  outcome: GameOutcome
  submit: { status: 'saving' | 'saved' | 'error'; result?: SubmitResult; message?: string } | null
  onAgain: () => void
  backTo: string
  backLabel: string
  passScore?: number
  embedded: boolean
}) {
  const score = toScore(outcome)
  const failed = passScore != null && score < passScore
  const r = submit?.result
  return (
    <div className="flex flex-col gap-4">
      <motion.section
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-brand-100"
      >
        <p className="text-5xl">{score >= 80 ? '🏆' : score >= 50 ? '⭐' : '💪'}</p>
        <p className="font-display text-5xl text-brand-700">{score}</p>
        <p className="text-slate-500">
          คะแนน (ถูก {Math.round(outcome.correct * 10) / 10} จาก {outcome.total})
        </p>
        {failed && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            ยังไม่ผ่าน ต้องได้อย่างน้อย {passScore} คะแนนจึงไปขั้นต่อไปได้ ดูเฉลยข้อที่ผิดแล้วเล่นอีกครั้งนะ
          </p>
        )}
        {embedded && passScore != null && !failed && <p className="font-display text-emerald-700">ผ่านขั้นเกมแล้ว! 🎉</p>}
        {submit?.status === 'saving' && <p className="text-sm text-slate-500">กำลังบันทึก…</p>}
        {submit?.status === 'error' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{submit.message}</p>}
        {r && (
          <div className="flex flex-col items-center gap-1">
            <p className="font-display text-2xl text-emerald-700">+{r.xp} XP</p>
            <p className="text-xs text-slate-500">
              {r.capped ? 'วันนี้รับ XP ของเกมนี้ครบ 3 รอบแล้ว (เล่นฝึกต่อได้)' : r.first_play ? 'รอบแรก ได้ XP เต็ม!' : 'รอบซ้ำได้ 20% ของ XP'} · คะแนนดีที่สุด {r.best_score ?? score}
            </p>
            {r.new_badges.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {r.new_badges.map((b) => (
                  <motion.span
                    key={b.code}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="rounded-full bg-sun-300 px-4 py-1.5 font-display text-amber-950 shadow"
                  >
                    {b.icon} ได้เหรียญ "{b.name}"
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={onAgain} disabled={submit?.status === 'saving'}>
            ↻ เล่นอีกครั้ง
          </Button>
          {!failed && !embedded && (
            <Link to={backTo} className="rounded-2xl px-5 py-2.5 font-display text-brand-700 ring-2 ring-brand-200 hover:bg-brand-100">
              {backLabel}
            </Link>
          )}
        </div>
      </motion.section>

      {outcome.mistakes.length > 0 && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
          <h2 className="mb-2 text-lg text-brand-900">เฉลยข้อที่ผิด</h2>
          <ul className="flex flex-col gap-2">
            {outcome.mistakes.map((m, i) => (
              <li key={i} className="rounded-2xl bg-rose-50 p-3 text-sm">
                <p className="font-display text-slate-800">{m.prompt}</p>
                <p className="text-rose-700">ตอบ: {m.yours}</p>
                <p className="text-emerald-700">ที่ถูก: {m.correct}</p>
                {m.explain && <p className="text-slate-500">💡 {m.explain}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
