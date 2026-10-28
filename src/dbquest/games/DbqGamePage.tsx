import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { NongDataSays } from '@/components/illustrations/NongData'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import { DbqError, fetchGameDeck, submitGameResult, type GameDeck, type GameResult } from '../lesson/dbqLessonApi'
import { canFlip, flip, hide, isComplete, isWaiting, matchScore, newGame, type MatchState } from './memoryMatch'

const primaryBtn = 'min-h-12 rounded-2xl bg-dq-600 px-6 font-display text-white shadow-[0_4px_0_0_var(--color-dq-900)] hover:bg-dq-700 disabled:opacity-50'
const secondaryBtn = 'inline-flex min-h-12 items-center rounded-2xl px-4 font-display text-dq-700 ring-2 ring-dq-200 hover:bg-dq-50 dark:text-dq-200 dark:ring-dq-700 dark:hover:bg-dq-800'

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

// หน้าเกม DB Quest: ตอนนี้มี Memory Match (สำรับมาจากเซิร์ฟเวอร์ ส่งผลผ่าน dbq_submit_game_result)
export function DbqGamePage() {
  const key = useParams().gameKey ?? ''
  const res = useAsync(() => loadDeck(key), [key])

  if (res.status === 'loading') return <LoadingBlock label="กำลังสับไพ่…" />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  if (res.data.kind === 'missing') return <NongDataSays mood="think">ไม่พบเกมนี้</NongDataSays>
  if (res.data.kind === 'locked') {
    return (
      <NongDataSays mood="think">
        <p>🔒 เกมนี้ยังเล่นไม่ได้ ทำขั้น "เปิดคาบ" "บทเรียน" และ "ฝึกปฏิบัติ" ในคาบให้ครบก่อนนะ</p>
        <Link to="/db/map" className={`${secondaryBtn} mt-3`}>
          ไปที่แผนที่การเรียน
        </Link>
      </NongDataSays>
    )
  }
  return <MemoryMatch deck={res.data.deck} />
}

type Phase = 'intro' | 'playing' | 'result'

function MemoryMatch({ deck }: { deck: GameDeck }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [final, setFinal] = useState<{ score: number; state: MatchState } | null>(null)
  const [submit, setSubmit] = useState<{ result?: GameResult; error?: string } | null>(null)
  const startedAt = useRef(0)

  const start = () => {
    setFinal(null)
    setSubmit(null)
    setRound((r) => r + 1)
    startedAt.current = Date.now()
    setPhase('playing')
  }

  const onFinish = useCallback(
    async (state: MatchState) => {
      const score = matchScore(state)
      const duration = Math.round((Date.now() - startedAt.current) / 1000)
      setFinal({ score, state })
      setPhase('result')
      try {
        setSubmit({ result: await submitGameResult(deck.game_key, score, duration) })
      } catch (e) {
        setSubmit({ error: e instanceof Error ? e.message : 'บันทึกคะแนนไม่สำเร็จ' })
      }
    },
    [deck.game_key],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to={`/db/lesson/${deck.session_no}`} className="text-base text-dq-700 underline-offset-2 hover:underline dark:text-dq-300">
        ← กลับไปคาบ {deck.session_no}
      </Link>
      {phase === 'intro' && (
        <section className="space-y-4 rounded-3xl bg-dq-700 p-6 text-center text-white">
          <h1 className="text-3xl">{deck.title}</h1>
          <p className="mx-auto max-w-lg">{deck.instructions}</p>
          <p className="text-base text-dq-100">
            {deck.pairs.length} คู่ · เวลา {Math.floor(deck.time_limit_sec / 60)} นาที · ⭐ ดาวใหม่ดาวละ 5 XP
          </p>
          <button type="button" onClick={start} className="min-h-12 rounded-2xl bg-xp-400 px-8 font-display text-xl text-orange-950 hover:bg-xp-300">
            ▶ เริ่มเล่น
          </button>
        </section>
      )}
      {phase === 'playing' && <Board key={round} deck={deck} onFinish={(s) => void onFinish(s)} />}
      {phase === 'result' && final && (
        <Result deck={deck} score={final.score} state={final.state} submit={submit} onAgain={start} />
      )}
    </div>
  )
}

function Board({ deck, onFinish }: { deck: GameDeck; onFinish: (s: MatchState) => void }) {
  const [state, setState] = useState(() => newGame(deck.pairs))
  const [left, setLeft] = useState(deck.time_limit_sec)
  const finished = useRef(false)
  const latest = useRef({ state, onFinish })
  latest.current = { state, onFinish }

  const end = useCallback((s: MatchState) => {
    if (finished.current) return
    finished.current = true
    latest.current.onFinish(s)
  }, [])

  // นับถอยหลัง
  useEffect(() => {
    const id = setInterval(() => setLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (left <= 0) end(latest.current.state)
  }, [left, end])

  // เปิดผิด: โชว์ไว้ครู่หนึ่งแล้วคว่ำ
  useEffect(() => {
    if (!isWaiting(state)) return
    const id = setTimeout(() => setState(hide), 900)
    return () => clearTimeout(id)
  }, [state])

  useEffect(() => {
    if (isComplete(state)) {
      const id = setTimeout(() => end(state), 500)
      return () => clearTimeout(id)
    }
  }, [state, end])

  const mm = Math.floor(Math.max(0, left) / 60)
  const ss = String(Math.max(0, left) % 60).padStart(2, '0')
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-display text-base" aria-live="polite">
        <span className={left <= 20 ? 'text-rose-600 dark:text-rose-300' : ''}>⏱ {mm}:{ss}</span>
        <span>
          ✓ {state.matched.length}/{deck.pairs.length} คู่
        </span>
        <span>✗ เปิดผิด {state.misses}</span>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {state.cards.map((c, i) => {
          const matched = state.matched.includes(c.pairId)
          const faceUp = matched || state.open.includes(i)
          const wrong = isWaiting(state) && state.open.includes(i)
          return (
            <li key={c.key}>
              <button
                type="button"
                disabled={!canFlip(state, i)}
                onClick={() => setState((s) => flip(s, i))}
                aria-label={faceUp ? `${c.side === 'term' ? 'คำศัพท์' : 'ความหมาย'}: ${c.text}` : `ไพ่ใบที่ ${i + 1} คว่ำอยู่`}
                className={`grid h-24 w-full place-items-center rounded-2xl p-2 text-center text-base leading-snug ring-2 transition ${
                  matched
                    ? 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800'
                    : wrong
                      ? 'bg-rose-100 text-rose-900 ring-rose-300 dark:bg-rose-950 dark:text-rose-100 dark:ring-rose-800'
                      : faceUp
                        ? c.side === 'term'
                          ? 'bg-dq-100 font-display text-dq-900 ring-dq-400 dark:bg-dq-800 dark:text-white'
                          : 'bg-amber-50 text-amber-950 ring-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800'
                        : 'bg-dq-600 text-3xl text-white ring-dq-700 hover:bg-dq-500 disabled:hover:bg-dq-600'
                }`}
              >
                {faceUp ? c.text : <span aria-hidden>?</span>}
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
    <span className="text-3xl tracking-widest" aria-label={`${n} ดาว`}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden className={i <= n ? '' : 'opacity-25 grayscale'}>
          ⭐
        </span>
      ))}
    </span>
  )
}

function Result({
  deck,
  score,
  state,
  submit,
  onAgain,
}: {
  deck: GameDeck
  score: number
  state: MatchState
  submit: { result?: GameResult; error?: string } | null
  onAgain: () => void
}) {
  const r = submit?.result
  return (
    <section className="space-y-4 rounded-3xl bg-white p-6 text-center ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800">
      <h2 className="text-2xl text-dq-900 dark:text-white">{isComplete(state) ? 'จับคู่ครบแล้ว! 🎉' : 'หมดเวลา ⏰'}</h2>
      <p className="font-display text-5xl text-dq-700 dark:text-dq-200">{score}</p>
      <p className="text-base text-slate-600 dark:text-dq-300">
        จับคู่ได้ {state.matched.length}/{deck.pairs.length} · เปิดผิด {state.misses} ครั้ง
      </p>
      <div aria-live="polite" className="space-y-1">
        {!submit && <p className="text-slate-500">กำลังบันทึกคะแนน…</p>}
        {submit?.error && <p className="text-rose-600 dark:text-rose-300">{submit.error}</p>}
        {r && (
          <>
            <Stars n={r.stars} />
            {r.preview ? (
              <p className="text-base">โหมดครู: ไม่บันทึกคะแนน</p>
            ) : (
              <>
                <p className="font-display text-xp-600 dark:text-xp-400">{r.xp > 0 ? `+${r.xp} XP` : 'ได้ดาวเท่าเดิม ลองทำให้ได้ดาวมากขึ้นสิ'}</p>
                <p className="text-base text-slate-600 dark:text-dq-300">
                  สถิติดีที่สุด {r.best_score} คะแนน · {r.best_stars} ดาว
                </p>
                {r.badges.includes('three-stars') && <p className="font-display">🏅 ได้เหรียญ "สามดาวแรก"</p>}
              </>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onAgain} className={primaryBtn}>
          เล่นอีกครั้ง
        </button>
        <Link to={`/db/lesson/${deck.session_no}`} className={secondaryBtn}>
          กลับไปคาบ {deck.session_no}
        </Link>
      </div>
    </section>
  )
}
