import { useMemo, useState, type ReactNode } from 'react'
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

  return config.mode === 'stream' ? <StreamSort config={config} onDone={afterSort} sfx={sfx} /> : <BoardSort config={config} onDone={afterSort} />
}

// ---------- แบบกระดาน: เห็นการ์ดทั้งหมด ลาก/แตะเพื่อจัด แล้วกดตรวจ ----------
function BoardSort({ config, onDone }: { config: SortConfig; onDone: (g: Graded) => void }) {
  const order = useMemo(() => scrambled(config.cards.length), [config.cards.length])
  const [placement, setPlacement] = useState<(string | null)[]>(() => config.cards.map(() => null))
  const [selected, setSelected] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const submit = () => onDone(gradeSort(config, placement))
  const left = useCountdown(config.timeLimitSec, submit, 'board')

  const place = (card: number, bucket: string | null) => {
    setPlacement((p) => p.map((b, i) => (i === card ? bucket : b)))
    setSelected(null)
  }
  const onDragEnd = (e: DragEndEvent) => {
    const card = Number(String(e.active.id).replace('card-', ''))
    if (e.over) place(card, e.over.id === 'tray' ? null : String(e.over.id))
  }
  const remaining = placement.filter((p) => p == null).length

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>เหลือ {remaining} ใบ · แตะการ์ดแล้วแตะกล่อง หรือลากวาง</span>
          {left != null && <span className={`font-display tabular-nums ${left <= 10 ? 'text-rose-600' : ''}`}>⏱ {left}</span>}
        </div>
        {config.story && <p className="rounded-2xl bg-sky-50 p-4 leading-relaxed text-sky-950 ring-1 ring-sky-200">📖 {config.story}</p>}

        <Tray>
          {order
            .filter((i) => placement[i] == null)
            .map((i) => (
              <DraggableCard key={i} index={i} text={config.cards[i]?.text ?? ''} selected={selected === i} onSelect={() => setSelected(selected === i ? null : i)} />
            ))}
          {remaining === 0 && <p className="text-sm text-slate-400">จัดครบแล้ว กดตรวจคำตอบได้เลย</p>}
        </Tray>

        <div className={`grid gap-3 ${config.buckets.length > 4 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {config.buckets.map((b) => (
            <DropBucket key={b.id} id={b.id} label={b.label} icon={b.icon} active={selected != null} onTap={() => selected != null && place(selected, b.id)}>
              {order
                .filter((i) => placement[i] === b.id)
                .map((i) => (
                  <DraggableCard key={i} index={i} text={config.cards[i]?.text ?? ''} small selected={selected === i} onSelect={() => setSelected(selected === i ? null : i)} />
                ))}
            </DropBucket>
          ))}
        </div>

        <Button onClick={submit} className="self-end">
          ✓ ตรวจคำตอบ
        </Button>
      </div>
    </DndContext>
  )
}

function Tray({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'tray' })
  return (
    <div ref={setNodeRef} className={`flex min-h-16 flex-wrap gap-2 rounded-2xl border-2 border-dashed p-3 ${isOver ? 'border-brand-400 bg-brand-50' : 'border-brand-200'}`}>
      {children}
    </div>
  )
}

function DraggableCard({ index, text, selected, onSelect, small }: { index: number; text: string; selected: boolean; onSelect: () => void; small?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `card-${index}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onSelect}
      aria-pressed={selected}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={`touch-none rounded-xl text-left shadow-sm ring-2 transition ${small ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} ${
        isDragging ? 'z-50 scale-105 bg-sun-300 shadow-lg ring-sun-400' : selected ? 'bg-sun-300 ring-sun-400' : 'bg-white ring-brand-100 hover:ring-brand-300'
      }`}
    >
      {text}
    </button>
  )
}

function DropBucket({
  id,
  label,
  icon,
  active,
  onTap,
  children,
}: {
  id: string
  label: string
  icon?: string
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
      aria-label={`กล่อง ${label}`}
      className={`flex min-h-28 flex-col gap-2 rounded-2xl p-3 ring-2 transition ${
        isOver ? 'bg-brand-100 ring-brand-500' : active ? 'cursor-pointer bg-brand-50 ring-brand-300 hover:bg-brand-100' : 'bg-brand-50/60 ring-brand-100'
      }`}
    >
      <p className="font-display text-brand-900">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
