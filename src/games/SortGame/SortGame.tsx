import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { gradeQuizAnswer, gradeSort, scrambled, type Graded } from '@/games/shared/logic'
import { QuizCard } from '@/games/shared/QuizCard'
import type { SortConfig } from '@/games/shared/schemas'
import type { GameProps, Mistake } from '@/games/shared/types'
import { useCountdown } from '@/games/shared/useGameTimer'

// เกมจัดกลุ่ม: 5G Time Machine, EV Garage, IP Hunter, Problem Detective, Blueprint Builder, Safety Check
export function SortGame({ config, onFinish, sfx }: GameProps<SortConfig>) {
  const [sorted, setSorted] = useState<Graded | null>(null)
  const [bonusIndex, setBonusIndex] = useState(0)
  const [bonusCorrect, setBonusCorrect] = useState(0)
  const [bonusMistakes, setBonusMistakes] = useState<Mistake[]>([])
  const bonus = config.bonus ?? []

  const done = (g: Graded, bc = bonusCorrect, bm = bonusMistakes) =>
    onFinish({ correct: g.correct + bc, total: g.total + bonus.length, mistakes: [...g.mistakes, ...bm] })

  const afterSort = (g: Graded) => {
    if (bonus.length === 0) done(g)
    else setSorted(g)
  }

  if (sorted) {
    const item = bonus[bonusIndex]
    if (!item) return null
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-full bg-sun-300/50 px-3 py-1 text-center font-display text-amber-900">⭐ คำถามโบนัส</p>
        <QuizCard
          key={bonusIndex}
          item={item}
          index={bonusIndex}
          total={bonus.length}
          onAnswered={(chosen) => {
            const r = gradeQuizAnswer(item, chosen)
            if (r.ok) sfx.correct()
            else sfx.wrong()
            const bc = bonusCorrect + (r.ok ? 1 : 0)
            const bm = r.mistake ? [...bonusMistakes, r.mistake] : bonusMistakes
            if (bonusIndex + 1 >= bonus.length) done(sorted, bc, bm)
            else {
              setBonusCorrect(bc)
              setBonusMistakes(bm)
              setBonusIndex(bonusIndex + 1)
            }
          }}
        />
      </div>
    )
  }

  return config.mode === 'stream' ? <StreamSort config={config} onDone={afterSort} sfx={sfx} /> : <BoardSort config={config} onDone={afterSort} sfx={sfx} />
}

// ---------- แบบกระดาน: เห็นการ์ดทั้งหมดบนสายพาน ลาก/แตะเพื่อจัดลงถัง กดตรวจแล้วเฉลยบนการ์ดก่อนไปต่อ ----------
// สีหัวถังตามลำดับ (IPO: น้ำเงิน → ม่วง → เขียว)
const BIN_TONES = [
  { head: 'from-sky-400 to-action-strong', well: 'bg-sky-50/80', ring: 'ring-sky-300' },
  { head: 'from-violet-400 to-violet-700', well: 'bg-violet-50/80', ring: 'ring-violet-300' },
  { head: 'from-emerald-400 to-mint-500', well: 'bg-emerald-50/80', ring: 'ring-emerald-300' },
  { head: 'from-amber-300 to-orange-500', well: 'bg-amber-50/80', ring: 'ring-amber-300' },
  { head: 'from-rose-400 to-rose-600', well: 'bg-rose-50/80', ring: 'ring-rose-300' },
  { head: 'from-cyan-400 to-teal-600', well: 'bg-cyan-50/80', ring: 'ring-cyan-300' },
]
const REVEAL_MS = 2600

function BoardSort({ config, onDone, sfx }: { config: SortConfig; onDone: (g: Graded) => void; sfx: GameProps<SortConfig>['sfx'] }) {
  const order = useMemo(() => scrambled(config.cards.length), [config.cards.length])
  const [placement, setPlacement] = useState<(string | null)[]>(() => config.cards.map(() => null))
  const [selected, setSelected] = useState<number | null>(null)
  // ตรวจแล้ว: แสดงถูก/ผิดบนการ์ดสักครู่ แล้วค่อยไปคำถามโบนัส/สรุปผล
  const [result, setResult] = useState<Graded | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const submit = () => {
    if (result) return
    const g = gradeSort(config, placement)
    setSelected(null)
    setResult(g)
    if (g.correct * 2 >= g.total) sfx.correct()
    else sfx.wrong()
  }
  const left = useCountdown(config.timeLimitSec, submit, 'board', result != null)

  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => done.current(result), REVEAL_MS)
    return () => clearTimeout(t)
  }, [result])

  const place = (card: number, bucket: string | null) => {
    if (result) return
    if (placement[card] !== bucket) sfx.tick()
    setPlacement((p) => p.map((b, i) => (i === card ? bucket : b)))
    setSelected(null)
  }
  const onDragEnd = (e: DragEndEvent) => {
    const card = Number(String(e.active.id).replace('card-', ''))
    if (e.over) place(card, e.over.id === 'tray' ? null : String(e.over.id))
  }
  const remaining = placement.filter((p) => p == null).length
  const placed = config.cards.length - remaining
  const cardState = (i: number) =>
    result ? (placement[i] === config.cards[i]?.bucket ? 'correct' : 'wrong') : selected === i ? 'picked' : 'idle'
  const pick = (i: number) => !result && setSelected(selected === i ? null : i)
  const lowTime = left != null && left <= 10

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex justify-between text-xs font-semibold text-ink-2">
              <span>
                จัดแล้ว {placed}/{config.cards.length}
              </span>
              <span className="hidden sm:inline">แตะการ์ด แล้วแตะถัง · หรือลากวาง</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface shadow-[inset_0_1px_3px_rgb(20_45_100/0.2)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-action to-gold-400 shadow-[0_0_10px_rgb(241_196_67/0.5)] transition-[width] duration-500"
                style={{ width: `${(placed / config.cards.length) * 100}%` }}
              />
            </div>
          </div>
          {left != null && (
            <span
              className={`grid size-14 shrink-0 place-items-center rounded-full font-display text-lg tabular-nums text-white shadow-[inset_0_-3px_6px_rgb(0_0_0/0.25),0_8px_16px_-8px_rgb(20_45_100/0.6)] ${
                lowTime ? 'animate-pulse bg-gradient-to-b from-coral-400 to-rose-600' : 'bg-gradient-to-b from-action to-action-strong'
              }`}
              aria-label={`เหลือเวลา ${left} วินาที`}
            >
              {left}
            </span>
          )}
        </div>
        {config.story && <p className="rounded-2xl bg-sky-50 p-4 leading-relaxed text-sky-950 ring-1 ring-sky-200">📖 {config.story}</p>}

        <Tray empty={remaining === 0}>
          {order
            .filter((i) => placement[i] == null)
            .map((i) => (
              <DraggableCard key={i} index={i} text={config.cards[i]?.text ?? ''} state={cardState(i)} locked={!!result} onSelect={() => pick(i)} />
            ))}
        </Tray>

        <div className={`grid gap-3 ${config.buckets.length === 3 ? 'sm:grid-cols-3' : config.buckets.length > 4 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {config.buckets.map((b, bi) => (
            <DropBucket
              key={b.id}
              id={b.id}
              label={b.label}
              icon={b.icon}
              tone={BIN_TONES[bi % BIN_TONES.length] ?? BIN_TONES[0]!}
              count={placement.filter((p) => p === b.id).length}
              active={selected != null}
              onTap={() => selected != null && place(selected, b.id)}
            >
              {order
                .filter((i) => placement[i] === b.id)
                .map((i) => (
                  <DraggableCard key={i} index={i} text={config.cards[i]?.text ?? ''} small state={cardState(i)} locked={!!result} onSelect={() => pick(i)} />
                ))}
            </DropBucket>
          ))}
        </div>

        {result ? (
          <div
            role="status"
            className={`tq-verdict flex flex-wrap items-center gap-3 rounded-2xl p-4 shadow-md ring-2 ${
              result.correct === result.total ? 'bg-gradient-to-br from-emerald-50 to-mint-400/25 ring-mint-500' : 'bg-gradient-to-br from-white to-brand-50 ring-brand-200'
            }`}
          >
            <span className="text-3xl" aria-hidden>
              {result.correct === result.total ? '🏆' : result.correct * 2 >= result.total ? '⭐' : '💪'}
            </span>
            <p className="min-w-0 flex-1 font-display text-lg text-ink">
              ถูก {result.correct} จาก {result.total} ใบ
              <span className="block text-sm font-normal text-ink-2">การ์ดสีเขียว = ถูก · สีแดง = ผิด ดูเฉลยได้ตอนสรุปผล</span>
            </p>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
              <span className="tq-countdown block h-full rounded-full bg-action" style={{ '--tq-countdown': `${REVEAL_MS}ms` } as CSSProperties} />
            </span>
          </div>
        ) : (
          <Button onClick={submit} className="self-end px-8 text-lg">
            ✓ ตรวจคำตอบ
          </Button>
        )}
      </div>
    </DndContext>
  )
}

function Tray({ empty, children }: { empty: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray' })
  return (
    <div className={`tq-belt relative rounded-3xl p-3 sm:p-4 ${isOver ? 'ring-4 ring-gold-400' : ''}`}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white/70">
        <span className="size-2 animate-pulse rounded-full bg-gold-400" aria-hidden /> สายพานการ์ด
      </p>
      <div ref={setNodeRef} className="flex min-h-14 flex-wrap gap-2.5">
        {children}
        {empty && <p className="self-center text-sm text-white/80">จัดครบแล้ว! กด “ตรวจคำตอบ” ได้เลย 🎯</p>}
      </div>
    </div>
  )
}

function DraggableCard({
  index,
  text,
  state,
  locked,
  onSelect,
  small,
}: {
  index: number
  text: string
  state: 'idle' | 'picked' | 'correct' | 'wrong'
  locked: boolean
  onSelect: () => void
  small?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `card-${index}`, disabled: locked })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onSelect}
      aria-pressed={state === 'picked'}
      data-state={isDragging ? 'picked' : state}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px) scale(1.05)`, zIndex: 50 } : undefined}
      className={`tq-chip relative touch-none text-left font-semibold ${small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm'}`}
    >
      {text}
      {state === 'correct' && <span className="ml-1.5 text-mint-500" aria-label="ถูก">✓</span>}
      {state === 'wrong' && <span className="ml-1.5 text-rose-600" aria-label="ผิด">✗</span>}
    </button>
  )
}

function DropBucket({
  id,
  label,
  icon,
  tone,
  count,
  active,
  onTap,
  children,
}: {
  id: string
  label: string
  icon?: string
  tone: (typeof BIN_TONES)[number]
  count: number
  active: boolean
  onTap: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}
      aria-label={`ถัง ${label} (${count} ใบ)`}
      data-ready={active || undefined}
      className={`tq-bin flex flex-col overflow-hidden rounded-3xl bg-white shadow-raise ring-2 transition duration-200 ${
        isOver ? `-translate-y-1 scale-[1.02] ${tone.ring}` : active ? `cursor-pointer ${tone.ring}` : 'ring-line'
      }`}
    >
      <div className={`relative flex items-center gap-2.5 bg-gradient-to-br px-3 py-2.5 text-white ${tone.head}`}>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/15" aria-hidden />
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/90 text-2xl shadow-[inset_0_-2px_4px_rgb(0_0_0/0.15),0_4px_8px_-3px_rgb(0_0_0/0.4)]">
          {icon ?? '🧺'}
        </span>
        <span className="min-w-0 flex-1 font-display leading-tight [text-shadow:0_1px_2px_rgb(0_0_0/0.3)]">{label}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-black/20 font-display text-sm tabular-nums">{count}</span>
      </div>
      <div className={`tq-bin-well m-2 flex min-h-24 flex-1 flex-wrap content-start gap-1.5 rounded-2xl p-2 ${tone.well}`}>
        {children}
        {count === 0 && <p className="m-auto text-xs text-slate-400">{active ? 'แตะเพื่อวางที่นี่' : 'วางการ์ดที่นี่'}</p>}
      </div>
    </div>
  )
}

// ---------- แบบไหลทีละใบ: ตอบทันที มีเวลาต่อใบ (IP Hunter, Safety Check, EV Garage) ----------
function StreamSort({ config, onDone, sfx }: { config: SortConfig; onDone: (g: Graded) => void; sfx: GameProps<SortConfig>['sfx'] }) {
  const order = useMemo(() => scrambled(config.cards.length), [config.cards.length])
  const [pos, setPos] = useState(0)
  const [placement, setPlacement] = useState<(string | null)[]>(() => config.cards.map(() => null))
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const cardIndex = order[pos] ?? 0
  const card = config.cards[cardIndex]

  const answer = (bucket: string | null) => {
    if (!card || flash) return
    const next = placement.map((p, i) => (i === cardIndex ? bucket : p))
    setPlacement(next)
    const ok = bucket === card.bucket
    if (ok) sfx.correct()
    else sfx.wrong()
    setFlash(ok ? 'ok' : 'bad')
    setTimeout(() => {
      setFlash(null)
      if (pos + 1 >= order.length) onDone(gradeSort(config, next))
      else setPos(pos + 1)
    }, 600)
  }
  const left = useCountdown(config.cardTimeSec, () => answer(null), pos, flash != null)
  if (!card) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          การ์ด {pos + 1} / {order.length}
        </span>
        {left != null && <span className={`font-display tabular-nums ${left <= 3 ? 'text-rose-600' : ''}`}>⏱ {left}</span>}
      </div>
      <div className="relative h-40 overflow-hidden rounded-3xl bg-gradient-to-b from-sky-50 to-brand-50 ring-1 ring-brand-100">
        <AnimatePresence mode="wait">
          <motion.div
            key={pos}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: config.cardTimeSec ? 40 : 30, opacity: 1 }}
            transition={{ y: { duration: config.cardTimeSec ?? 0.4, ease: 'linear' }, opacity: { duration: 0.2 } }}
            exit={{ scale: 0.6, opacity: 0 }}
            className={`absolute inset-x-6 mx-auto max-w-md rounded-2xl px-4 py-3 text-center font-display text-lg shadow-lg ring-2 ${
              flash === 'ok' ? 'bg-mint-500 text-white ring-mint-500' : flash === 'bad' ? 'bg-coral-400 text-white ring-coral-400' : 'bg-white ring-sun-400'
            }`}
          >
            {card.text}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={`grid gap-2 ${config.buckets.length > 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {config.buckets.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={flash != null}
            onClick={() => answer(b.id)}
            className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-2 py-2 text-center font-display text-sm ring-2 ring-brand-200 transition hover:-translate-y-0.5 hover:bg-brand-50 disabled:opacity-60"
          >
            <span className="text-2xl">{b.icon ?? '🧺'}</span>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}
