import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Layers, Lock, Medal, Play, RotateCcw, Star, Timer } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { NongDataSays } from '@/components/illustrations/NongData'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { completeStep, DbqError, fetchGameDeck, submitGameResult, type GameDeck, type GameResult } from '../lesson/dbqLessonApi'
import { canFlip, flip, hide, isComplete, isWaiting, matchScore, newGame, starDeadlines, starsForScore, timeScore, type MatchState } from './memoryMatch'

const secondaryBtn =
  'inline-flex min-h-12 items-center rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 hover:bg-dq-50 dark:text-dq-200 dark:ring-dq-700 dark:hover:bg-dq-800'
// ปุ่มทองนูน: ขอบล่างหนาให้ดูเป็นปุ่มกดจริง
const goldBtn = 'dq-gold-btn inline-flex min-h-14 items-center gap-2 rounded-2xl px-7 font-display text-xl text-orange-950 disabled:opacity-60'
const glassBtn =
  'inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white/10 px-5 font-display text-white ring-1 ring-white/30 hover:bg-white/20'
const chip = 'inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15'
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

type Loaded = { kind: 'ok'; deck: GameDeck } | { kind: 'locked' } | { kind: 'missing' }

async function loadDeck(key: string): Promise<Loaded> {
  try {
    return { kind: 'ok', deck: await fetchGameDeck(key) }
  } catch (e) {
    if (e instanceof DbqError && e.code === 'locked') return { kind: 'locked' }
    if (e instanceof DbqError && e.code === 'game_not_found') return { kind: 'missing' }
    throw e
  }
}

// เกมที่ฝังอยู่ในขั้น "เกมประจำหน่วย" ของหน้าคาบ: เล่นจบแล้วไปขั้นถัดไปได้ทันที
export interface Embedded {
  // เซิร์ฟเวอร์บันทึกขั้นเกมแล้ว (xp ของขั้น)
  onStepDone: (xp: number) => void
  nextLabel: string
  onNext: () => void
}

// หน้าเกม DB Quest: ตอนนี้มี Memory Match (สำรับมาจากเซิร์ฟเวอร์ ส่งผลผ่าน dbq_submit_game_result)
export function DbqGamePage() {
  return <GameView gameKey={useParams().gameKey ?? ''} />
}

export function GameView({ gameKey, embedded }: { gameKey: string; embedded?: Embedded }) {
  const res = useAsync(() => loadDeck(gameKey), [gameKey])

  if (res.status === 'loading') return <LoadingBlock label="กำลังสับไพ่…" />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  if (res.data.kind === 'missing') return <NongDataSays mood="think">ไม่พบเกมนี้</NongDataSays>
  if (res.data.kind === 'locked') {
    return (
      <NongDataSays mood="think">
        <p>
          <Lock className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> คาบของเกมนี้ยังไม่เปิด รอครูปลดล็อกในชั่วโมงเรียนนะ
        </p>
        <Link to="/db/map" className={`${secondaryBtn} mt-3`}>
          ไปที่บทเรียน
        </Link>
      </NongDataSays>
    )
  }
  return <MemoryMatch deck={res.data.deck} embedded={embedded} />
}

type Phase = 'intro' | 'playing' | 'result'

// สีกรอบของคู่ที่จับได้: 2 ใบในคู่เดียวกันสีเดียวกัน แต่ละคู่สีไม่ซ้ำ (บอร์ดพื้นเข้มเสมอ หน้าไพ่จึงสว่างทั้งสองโหมด)
const PAIR_TONES = [
  'bg-violet-50 text-violet-950 ring-violet-500',
  'bg-sky-50 text-sky-950 ring-sky-500',
  'bg-amber-50 text-amber-950 ring-amber-500',
  'bg-emerald-50 text-emerald-950 ring-emerald-500',
  'bg-rose-50 text-rose-950 ring-rose-500',
  'bg-teal-50 text-teal-950 ring-teal-500',
  'bg-indigo-50 text-indigo-950 ring-indigo-500',
  'bg-lime-50 text-lime-950 ring-lime-600',
]

function MemoryMatch({ deck, embedded }: { deck: GameDeck; embedded?: Embedded }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [final, setFinal] = useState<{
    score: number
    duration: number
    state: MatchState
  } | null>(null)
  const [submit, setSubmit] = useState<{
    result?: GameResult
    error?: string
  } | null>(null)
  const startedAt = useRef(0)
  const onStepDone = useRef(embedded?.onStepDone)
  onStepDone.current = embedded?.onStepDone

  const start = () => {
    setFinal(null)
    setSubmit(null)
    setRound((r) => r + 1)
    startedAt.current = Date.now()
    setPhase('playing')
  }

  const onFinish = useCallback(
    async (state: MatchState) => {
      // เซิร์ฟเวอร์รับเวลาเล่นได้ไม่เกิน 7200 วินาที (เกินนั้นคะแนนต่ำสุดอยู่แล้ว)
      const duration = Math.min(7200, Math.round((Date.now() - startedAt.current) / 1000))
      const score = matchScore(state, duration, deck.time_limit_sec)
      setFinal({ score, duration, state })
      setPhase('result')
      try {
        const result = await submitGameResult(deck.game_key, score, duration)
        // เล่นจบ = ผ่านขั้น "เกม" ของคาบ (เซิร์ฟเวอร์ตรวจว่ามีคะแนนจริง) ไม่ต้องกดซ้ำในหน้าคาบ
        if (!result.preview) {
          const step = await completeStep(deck.session_no, 'game').catch(() => null)
          if (step) onStepDone.current?.(step.xp)
        }
        setSubmit({ result })
      } catch (e) {
        setSubmit({
          error: e instanceof Error ? e.message : 'บันทึกคะแนนไม่สำเร็จ',
        })
      }
    },
    [deck.game_key, deck.session_no, deck.time_limit_sec],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {!embedded && (
        <Link to={`/db/lesson/${deck.session_no}`} className="text-base text-dq-700 underline-offset-2 hover:underline dark:text-dq-300">
          ← กลับไปคาบ {deck.session_no}
        </Link>
      )}
      {phase === 'intro' && <Intro deck={deck} onStart={start} />}
      {phase === 'playing' && <Board key={round} deck={deck} onFinish={(s) => void onFinish(s)} />}
      {phase === 'result' && final && (
        <Result deck={deck} score={final.score} duration={final.duration} submit={submit} onAgain={start} embedded={embedded} />
      )}
    </div>
  )
}

function Intro({ deck, onStart }: { deck: GameDeck; onStart: () => void }) {
  const d = starDeadlines(deck.time_limit_sec)
  return (
    <section className="dq-stage relative overflow-hidden rounded-[1.75rem] px-6 py-9 text-center text-white sm:px-10 sm:py-11">
      {/* ไพ่ตกแต่งเอียง ลอยขึ้นลงช้า ๆ อยู่ด้านหลัง */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="dq-deco left-[5%] top-[12%] [--tilt:-12deg]" />
        <span className="dq-deco right-[6%] top-[9%] [--tilt:14deg] [animation-delay:-2s]" />
        <span className="dq-deco bottom-[9%] left-[13%] [--tilt:7deg] [animation-delay:-4s] max-sm:hidden" />
        <span className="dq-deco bottom-[12%] right-[12%] [--tilt:-9deg] [animation-delay:-1s] max-sm:hidden" />
      </div>
      <div className="relative space-y-4">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_24px_-10px_rgb(0_0_0/0.6)] ring-1 ring-white/30">
          <Layers className="size-8" aria-hidden />
        </span>
        <h2 className="text-3xl leading-tight drop-shadow-[0_2px_6px_rgb(0_0_0/0.35)] sm:text-4xl">{deck.title}</h2>
        <p className="mx-auto max-w-lg text-dq-100">{deck.instructions}</p>
        <ul className="flex flex-wrap justify-center gap-2 text-base">
          <li className={chip}>{deck.pairs.length} คู่</li>
          <li className={chip}>
            <Timer className="size-4" aria-hidden /> ไม่จำกัดเวลา
          </li>
          <li className={chip}>
            <Star className="size-4 fill-xp-400 text-xp-400" aria-hidden /> จบภายใน {clock(d.three)} ได้ 3 ดาว · {clock(d.two)} ได้ 2 ดาว
          </li>
          <li className={chip}>ดาวใหม่ดาวละ 5 XP</li>
        </ul>
        <button type="button" onClick={onStart} className={goldBtn}>
          <Play className="size-5 fill-current" aria-hidden /> เริ่มเล่น
        </button>
      </div>
    </section>
  )
}

function Board({ deck, onFinish }: { deck: GameDeck; onFinish: (s: MatchState) => void }) {
  const [state, setState] = useState(() => newGame(deck.pairs))
  const [elapsed, setElapsed] = useState(0)
  const finished = useRef(false)
  const latest = useRef({ onFinish })
  latest.current = { onFinish }

  const end = useCallback((s: MatchState) => {
    if (finished.current) return
    finished.current = true
    latest.current.onFinish(s)
  }, [])

  // จับเวลาเดินหน้า (ไม่มีหมดเวลา) — หยุดเมื่อจับคู่ครบ
  const complete = isComplete(state)
  const startAt = useRef(Date.now())
  useEffect(() => {
    if (complete) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startAt.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [complete])

  // เปิดผิด: โชว์ไว้ครู่หนึ่งแล้วคว่ำ
  useEffect(() => {
    if (!isWaiting(state)) return
    const id = setTimeout(() => setState(hide), 900)
    return () => clearTimeout(id)
  }, [state])

  useEffect(() => {
    if (complete) {
      const id = setTimeout(() => end(state), 700)
      return () => clearTimeout(id)
    }
  }, [complete, state, end])

  const pairIndex = new Map(deck.pairs.map((p, i) => [p.id, i]))
  // ดาวที่ยังได้ถ้าจบตอนนี้ (บอกให้รู้ว่าต้องรีบแค่ไหน)
  const stars = starsForScore(timeScore(elapsed, deck.time_limit_sec))
  return (
    <section className="dq-stage space-y-4 rounded-[1.75rem] p-3 text-white sm:p-5">
      <div className="space-y-2 px-1 pt-1">
        <div className="flex flex-wrap items-center gap-2 font-display text-base">
          <span className={chip} role="timer" aria-label={`ใช้เวลา ${clock(elapsed)}`}>
            <Timer className="size-4" aria-hidden /> {clock(elapsed)}
          </span>
          <span className={chip} aria-live="polite">
            ✓ {state.matched.length}/{deck.pairs.length} คู่
          </span>
          <span className={chip} aria-label={`จบตอนนี้ได้ ${stars} ดาว`}>
            {[1, 2, 3].map((i) => (
              <Star key={i} aria-hidden className={`size-4 transition-colors ${i <= stars ? 'fill-xp-400 text-xp-400' : 'fill-white/10 text-white/30'}`} />
            ))}
          </span>
        </div>
        {/* แถบคู่ที่จับได้ */}
        <div className="h-2 overflow-hidden rounded-full bg-black/30 shadow-[inset_0_1px_2px_rgb(0_0_0/0.45)]" aria-hidden>
          <div
            className="h-full rounded-full bg-linear-to-r from-xp-300 to-xp-500 transition-[width] duration-500"
            style={{ width: `${(state.matched.length / deck.pairs.length) * 100}%` }}
          />
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {state.cards.map((c, i) => {
          const matched = state.matched.includes(c.pairId)
          const faceUp = matched || state.open.includes(i)
          const wrong = isWaiting(state) && state.open.includes(i)
          const face = matched
            ? `ring-[3px] ${PAIR_TONES[(pairIndex.get(c.pairId) ?? 0) % PAIR_TONES.length]}`
            : wrong
              ? 'bg-rose-100 text-rose-900 ring-2 ring-rose-400'
              : c.side === 'term'
                ? 'bg-white font-display text-dq-900 ring-2 ring-dq-300'
                : 'bg-amber-50 text-amber-950 ring-2 ring-amber-300'
          return (
            <li key={c.key}>
              <button
                type="button"
                disabled={!canFlip(state, i)}
                onClick={() => setState((s) => flip(s, i))}
                aria-label={faceUp ? `${c.side === 'term' ? 'คำศัพท์' : 'ความหมาย'}: ${c.text}` : `ไพ่ใบที่ ${i + 1} คว่ำอยู่`}
                data-up={faceUp}
                data-matched={matched || undefined}
                data-wrong={wrong || undefined}
                className="dq-card block w-full rounded-2xl text-center outline-offset-4"
              >
                <span className="dq-card-inner">
                  <span aria-hidden className="dq-face dq-back">
                    <span className="grid size-11 place-items-center rounded-full bg-white/15 font-display text-2xl ring-1 ring-white/35">?</span>
                  </span>
                  <span aria-hidden className={`dq-face dq-front text-sm leading-snug [overflow-wrap:anywhere] sm:text-base ${face}`}>
                    {c.text}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-end gap-1.5" aria-label={`${n} ดาว`}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`${i === 2 ? 'size-14' : 'size-11'} ${i <= n ? 'dq-star-on fill-xp-400 text-xp-500' : 'fill-white/10 text-white/30'}`}
          style={{ animationDelay: `${(i - 1) * 140}ms` }}
        />
      ))}
    </span>
  )
}

function Result({
  deck,
  score,
  duration,
  submit,
  onAgain,
  embedded,
}: {
  deck: GameDeck
  score: number
  duration: number
  submit: { result?: GameResult; error?: string } | null
  onAgain: () => void
  embedded?: Embedded
}) {
  const r = submit?.result
  return (
    <section className="dq-stage space-y-5 rounded-[1.75rem] px-6 py-8 text-center text-white">
      <h2 className="text-2xl sm:text-3xl">จับคู่ครบแล้ว!</h2>
      <div className="mx-auto grid size-32 place-items-center rounded-full bg-linear-to-b from-white to-dq-100 text-dq-800 shadow-[0_0_0_6px_rgb(255_255_255/0.12),inset_0_-6px_12px_rgb(30_70_150/0.18),0_18px_36px_-12px_rgb(0_0_0/0.6)]">
        <span>
          <span className="block font-display text-5xl leading-none">{score}</span>
          <span className="text-sm text-dq-600">คะแนน</span>
        </span>
      </div>
      <p className="text-base text-dq-100">
        ใช้เวลา {clock(duration)} · ครบ {deck.pairs.length} คู่
      </p>
      <div aria-live="polite" className="space-y-2">
        {!submit && <p className="text-dq-200">กำลังบันทึกคะแนน…</p>}
        {submit?.error && <p className="text-rose-200">{submit.error}</p>}
        {r && (
          <>
            <Stars n={r.stars} />
            {r.preview ? (
              <p className="text-base">โหมดครู: ไม่บันทึกคะแนน</p>
            ) : (
              <>
                <p className="font-display text-xl text-xp-300">{r.xp > 0 ? `+${r.xp} XP` : 'ได้ดาวเท่าเดิม ลองทำให้ได้ดาวมากขึ้นสิ'}</p>
                <p className="text-base text-dq-100">
                  สถิติดีที่สุด {r.best_score} คะแนน · {r.best_stars} ดาว
                </p>
                {r.badges.includes('three-stars') && (
                  <p className="flex items-center justify-center gap-1.5 font-display">
                    <Medal className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden /> ได้เหรียญ "สามดาวแรก"
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onAgain} className={glassBtn}>
          <RotateCcw className="size-4" aria-hidden /> เล่นอีกครั้ง
        </button>
        {embedded ? (
          <button type="button" onClick={embedded.onNext} disabled={!submit} className={goldBtn}>
            {embedded.nextLabel} <ArrowRight className="size-5" aria-hidden />
          </button>
        ) : (
          <Link to={`/db/lesson/${deck.session_no}?after=game`} className={goldBtn}>
            ไปขั้นต่อไปของคาบ {deck.session_no} <ArrowRight className="size-5" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}
