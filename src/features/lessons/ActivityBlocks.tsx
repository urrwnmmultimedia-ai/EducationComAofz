import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Markdown } from './Markdown'
import type { FlowNode, TimelineEvent } from './lessonFormat'

// บล็อกภาพเคลื่อนไหวและกิจกรรมในการ์ดบทเรียน ม.3 — ไม่เก็บคะแนน ไม่บังคับ (ทำซ้ำได้)
// เขียนในเนื้อหาด้วย :::flow / :::sort / :::order / :::flip / :::timeline / :::bars (ดู lessonFormat.ts)

// สุ่มแบบคงที่ตามเนื้อหา: เปิดกี่ครั้งก็ได้ลำดับเดิม (ไม่กระโดดตอนเรนเดอร์ใหม่)
function seededOrder(n: number, seedText: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j] as number, idx[i] as number]
  }
  // ไม่ให้ออกมาเรียงถูกอยู่แล้ว
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift() as number)
  return idx
}

function ActivityFrame({ badge, tone = 'brand', prompt, children }: { badge: string; tone?: 'brand' | 'amber' | 'mint'; prompt?: string; children: ReactNode }) {
  const ring = { brand: 'from-brand-50', amber: 'from-amber-50/80', mint: 'from-mint-400/10' }[tone]
  const text = { brand: 'text-brand-700', amber: 'text-amber-700', mint: 'text-emerald-800' }[tone]
  return (
    <section className={`tq-raised my-5 bg-gradient-to-b to-white p-4 sm:p-5 ${ring}`}>
      <p className={`mb-1 font-display ${text}`}>{badge}</p>
      {prompt && (
        <div className="mb-3 font-semibold text-ink">
          <Markdown text={prompt} />
        </div>
      )}
      {children}
    </section>
  )
}

function Done({ children, onReset }: { children: ReactNode; onReset: () => void }) {
  return (
    <div role="status" className="tq-verdict mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-mint-400/20 p-3 ring-2 ring-mint-500">
      <p className="font-display text-emerald-800">{children}</p>
      <ResetButton onClick={onReset} label="เล่นอีกครั้ง" />
    </div>
  )
}

function ResetButton({ onClick, label = 'เริ่มใหม่' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 font-display text-sm text-brand-700 ring-1 ring-brand-300 hover:bg-brand-50"
    >
      <RotateCcw className="size-4" aria-hidden /> {label}
    </button>
  )
}

// ---------- แผนภาพลำดับขั้น: ลูกศรวิ่ง กดเล่นทีละขั้น หรือแตะกล่องดูคำอธิบาย ----------
export function FlowBlock({ prompt, nodes, cycle }: { prompt: string; nodes: FlowNode[]; cycle: boolean }) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const visit = (i: number) => {
    setActive(i)
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)))
  }
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      const next = active + 1
      if (next < nodes.length) visit(next)
      else if (cycle) visit(0)
      if (next >= nodes.length) setPlaying(false)
    }, 1400)
    return () => clearTimeout(t)
  }, [playing, active, nodes.length, cycle])
  const node = nodes[active]

  return (
    <ActivityFrame badge={cycle ? '🔄 แผนภาพวงจร — แตะแต่ละขั้น' : '🎬 ดูการทำงานทีละขั้น — แตะแต่ละกล่อง'} prompt={prompt}>
      <ol className="flex flex-col items-stretch gap-0 sm:flex-row sm:flex-wrap sm:items-center">
        {nodes.map((n, i) => {
          const on = i === active
          const passed = i < active
          return (
            <li key={`${n.label}-${i}`} className="flex flex-col items-center sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  visit(i)
                }}
                aria-pressed={on}
                className={`flex w-full min-w-28 items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition sm:w-auto sm:flex-col sm:text-center ${
                  on
                    ? 'tq-glow scale-[1.04] bg-action text-white shadow-action'
                    : passed
                      ? 'bg-brand-100 text-brand-900 ring-1 ring-brand-300'
                      : 'bg-white text-brand-900 ring-1 ring-brand-200 hover:bg-brand-50'
                }`}
              >
                <span className="text-2xl sm:text-3xl" aria-hidden>
                  {n.icon}
                </span>
                <span className="font-display leading-tight">{n.label}</span>
                {seen.has(i) && !on && <span className="ml-auto text-xs text-mint-500 sm:ml-0">✓</span>}
              </button>
              {i < nodes.length - 1 && (
                <span aria-hidden className={`flex items-center justify-center ${passed ? 'text-action' : 'text-brand-300'}`}>
                  <span className="tq-flow-line-v block h-6 w-1 rounded-full sm:hidden" />
                  <span className="tq-flow-line hidden h-1 w-8 rounded-full sm:block" />
                  <span className="hidden text-lg leading-none sm:inline">▸</span>
                </span>
              )}
            </li>
          )
        })}
        {cycle && (
          <li aria-hidden className="mt-1 self-center rounded-full bg-amber-100 px-3 py-1 text-sm font-display text-amber-800 sm:ml-2 sm:mt-0">
            ↺ วนกลับไปขั้นที่ 1
          </li>
        )}
      </ol>
      <div aria-live="polite" className="mt-3 min-h-16">
        <AnimatePresence mode="wait">
          {node && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="rounded-2xl bg-white p-3 ring-1 ring-brand-100"
            >
              <p className="font-display text-brand-800">
                ขั้นที่ {active + 1}: {node.icon} {node.label}
              </p>
              {node.detail && <Markdown text={node.detail} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing) visit(active >= nodes.length - 1 ? 0 : active)
            setPlaying(!playing)
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3 py-1.5 font-display text-sm text-white hover:bg-brand-600"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? 'หยุด' : 'เล่นอัตโนมัติ'}
        </button>
        <span className="text-sm text-slate-500">
          ดูแล้ว {seen.size}/{nodes.length} ขั้น{seen.size === nodes.length ? ' 🎉' : ''}
        </span>
      </div>
    </ActivityFrame>
  )
}

// ---------- เกมจัดกลุ่ม: แตะการ์ด แล้วแตะกลุ่มที่ใช่ ----------
const GROUP_TONE = [
  'bg-sky-50 ring-sky-200 text-sky-900',
  'bg-amber-50 ring-amber-200 text-amber-900',
  'bg-emerald-50 ring-emerald-200 text-emerald-900',
  'bg-rose-50 ring-rose-200 text-rose-900',
  'bg-violet-50 ring-violet-200 text-violet-900',
]

export function SortBlock({ prompt, groups, items }: { prompt: string; groups: string[]; items: { text: string; group: number }[] }) {
  const order = useMemo(() => seededOrder(items.length, items.map((i) => i.text).join('|')), [items])
  const [placed, setPlaced] = useState<ReadonlySet<number>>(() => new Set())
  const [picked, setPicked] = useState<number | null>(null)
  const [wrong, setWrong] = useState<{ group: number; n: number } | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const done = placed.size === items.length

  const drop = (g: number) => {
    if (picked === null) return
    const item = items[picked]
    if (!item) return
    if (item.group === g) {
      setPlaced((s) => new Set(s).add(picked))
      setPicked(null)
      setWrong(null)
    } else {
      setMistakes((m) => m + 1)
      setWrong((w) => ({ group: g, n: (w?.n ?? 0) + 1 }))
    }
  }
  const reset = () => {
    setPlaced(new Set())
    setPicked(null)
    setWrong(null)
    setMistakes(0)
  }

  return (
    <ActivityFrame badge="🧺 เกมจัดกลุ่ม — แตะการ์ด แล้วแตะกลุ่มที่ใช่" tone="amber" prompt={prompt}>
      <div className="flex min-h-14 flex-wrap gap-2 rounded-2xl bg-white/70 p-2 ring-1 ring-amber-100">
        {order
          .filter((i) => !placed.has(i))
          .map((i) => (
            <button
              key={i}
              type="button"
              data-state={picked === i ? 'picked' : undefined}
              aria-pressed={picked === i}
              onClick={() => {
                setPicked(picked === i ? null : i)
                setWrong(null)
              }}
              className="tq-chip px-3 py-2 text-left text-sm sm:text-base"
            >
              {items[i]?.text}
            </button>
          ))}
        {done && <span className="self-center px-2 text-sm text-slate-500">ไม่มีการ์ดเหลือแล้ว</span>}
      </div>
      <p className="mt-2 min-h-5 text-sm text-slate-600" aria-live="polite">
        {wrong
          ? `✗ "${items[picked ?? -1]?.text ?? ''}" ไม่ได้อยู่กลุ่ม ${groups[wrong.group]} ลองกลุ่มอื่นนะ`
          : picked !== null
            ? `เลือก "${items[picked]?.text}" แล้ว — แตะกลุ่มที่ใช่`
            : done
              ? ''
              : 'แตะการ์ดหนึ่งใบก่อน'}
      </p>
      <div className={`mt-2 grid gap-3 ${groups.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} ${groups.length === 4 ? 'lg:grid-cols-4' : ''}`}>
        {groups.map((g, gi) => (
          <button
            key={`${g}-${wrong?.group === gi ? wrong.n : 0}`}
            type="button"
            onClick={() => drop(gi)}
            disabled={picked === null}
            className={`flex min-h-24 flex-col items-stretch gap-1.5 rounded-2xl p-3 text-left ring-2 transition disabled:cursor-default ${GROUP_TONE[gi % GROUP_TONE.length]} ${
              picked !== null ? 'ring-offset-2 hover:-translate-y-0.5' : ''
            } ${wrong?.group === gi ? 'tq-shake' : ''}`}
          >
            <span className="font-display">{g}</span>
            {items.map((it, i) =>
              it.group === gi && placed.has(i) ? (
                <motion.span
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-xl bg-white/90 px-2 py-1 text-sm text-ink shadow-sm"
                >
                  ✓ {it.text}
                </motion.span>
              ) : null,
            )}
          </button>
        ))}
      </div>
      {done && (
        <Done onReset={reset}>
          🎉 จัดครบทุกการ์ด!{mistakes === 0 ? ' ไม่ผิดเลยสักครั้ง สุดยอด' : ` (เลือกผิด ${mistakes} ครั้ง)`}
        </Done>
      )}
    </ActivityFrame>
  )
}

// ---------- เกมเรียงลำดับ: แตะขั้นที่มาก่อนทีละขั้น ----------
export function OrderBlock({ prompt, items }: { prompt: string; items: string[] }) {
  const order = useMemo(() => seededOrder(items.length, items.join('|')), [items])
  const [count, setCount] = useState(0) // ขั้นที่เรียงถูกแล้ว (items[0..count-1])
  const [wrong, setWrong] = useState<{ i: number; n: number } | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const done = count === items.length
  const tap = (i: number) => {
    if (i === count) {
      setCount(count + 1)
      setWrong(null)
    } else {
      setMistakes((m) => m + 1)
      setWrong((w) => ({ i, n: (w?.n ?? 0) + 1 }))
    }
  }
  const reset = () => {
    setCount(0)
    setWrong(null)
    setMistakes(0)
  }
  return (
    <ActivityFrame badge="🔢 เกมเรียงลำดับ — แตะขั้นที่มาก่อนทีละขั้น" tone="mint" prompt={prompt}>
      <ol className="flex flex-col gap-2">
        {items.slice(0, count).map((t, i) => (
          <motion.li
            key={t}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-2 ring-mint-400"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mint-500 text-sm font-bold text-white">{i + 1}</span>
            <span>{t}</span>
          </motion.li>
        ))}
        {!done &&
          Array.from({ length: items.length - count }, (_, k) => (
            <li key={`slot-${k}`} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-mint-400/50 px-3 py-2 text-slate-400">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-sm font-bold ring-1 ring-mint-400/50">{count + k + 1}</span>
              {k === 0 ? 'ขั้นนี้คืออะไร? แตะด้านล่าง' : '…'}
            </li>
          ))}
      </ol>
      {!done && (
        <div className="mt-3 flex flex-wrap gap-2">
          {order
            .filter((i) => i >= count)
            .map((i) => (
              <button
                key={`${i}-${wrong?.i === i ? wrong.n : 0}`}
                type="button"
                onClick={() => tap(i)}
                className={`tq-chip px-3 py-2 text-left text-sm sm:text-base ${wrong?.i === i ? 'tq-shake' : ''}`}
              >
                {items[i]}
              </button>
            ))}
        </div>
      )}
      <p className="mt-2 min-h-5 text-sm text-rose-700" aria-live="polite">
        {wrong && !done ? '✗ ยังไม่ใช่ขั้นนี้ ลองคิดว่าอะไรต้องเกิดก่อน' : ''}
      </p>
      {done && <Done onReset={reset}>🎉 เรียงถูกครบ {items.length} ขั้น!{mistakes === 0 ? ' ไม่ผิดเลย' : ` (ผิด ${mistakes} ครั้ง)`}</Done>}
    </ActivityFrame>
  )
}

// ---------- การ์ดพลิก: เดาในใจก่อน แล้วแตะพลิกดูคำตอบ ----------
export function FlipBlock({ prompt, cards }: { prompt: string; cards: { front: string; back: string }[] }) {
  const [flipped, setFlipped] = useState<ReadonlySet<number>>(() => new Set())
  const [ever, setEver] = useState<ReadonlySet<number>>(() => new Set())
  const toggle = (i: number) => {
    setFlipped((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
    setEver((s) => (s.has(i) ? s : new Set(s).add(i)))
  }
  return (
    <ActivityFrame badge="🃏 การ์ดพลิก — คิดคำตอบในใจก่อน แล้วแตะพลิก" prompt={prompt}>
      <div className={`grid gap-3 ${cards.length === 1 ? '' : 'sm:grid-cols-2'} ${cards.length >= 3 && cards.length !== 4 ? 'lg:grid-cols-3' : ''}`}>
        {cards.map((c, i) => (
          <button
            key={`${c.front}-${i}`}
            type="button"
            aria-pressed={flipped.has(i)}
            aria-label={flipped.has(i) ? `${c.front}: ${c.back}` : `${c.front} (แตะเพื่อพลิก)`}
            data-flipped={flipped.has(i)}
            onClick={() => toggle(i)}
            className="tq-flip h-36 w-full text-left"
          >
            <span className="tq-flip-inner block">
              <span className="tq-flip-face flex flex-col justify-between rounded-2xl bg-gradient-to-br from-action to-action-strong p-4 text-white shadow-action">
                <span className="text-lg font-semibold leading-snug">{c.front}</span>
                <span className="text-sm text-brand-100">แตะเพื่อพลิก ↻</span>
              </span>
              <span className="tq-flip-face tq-flip-back flex items-center overflow-y-auto rounded-2xl bg-white p-4 text-ink ring-2 ring-action">
                <span className="leading-snug">{c.back}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-right text-sm text-slate-500">
        พลิกแล้ว {ever.size}/{cards.length} ใบ{ever.size === cards.length ? ' 🎉' : ''}
      </p>
    </ActivityFrame>
  )
}

// ---------- เส้นเวลา: เลื่อนแถบหรือกดเล่น ดูการเปลี่ยนแปลงทีละช่วง ----------
export function TimelineBlock({ prompt, events }: { prompt: string; events: TimelineEvent[] }) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set([0]))
  const go = (n: number) => {
    setI(n)
    setSeen((s) => (s.has(n) ? s : new Set(s).add(n)))
  }
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (i + 1 < events.length) go(i + 1)
      else setPlaying(false)
    }, 1800)
    return () => clearTimeout(t)
  }, [playing, i, events.length])
  const ev = events[i]
  const pct = events.length > 1 ? (i / (events.length - 1)) * 100 : 0
  return (
    <ActivityFrame badge="⏳ เส้นเวลา — เลื่อนแถบหรือแตะแต่ละช่วง" prompt={prompt}>
      <div className="relative px-3 pt-2">
        <div className="absolute inset-x-3 top-[1.65rem] h-1.5 rounded-full bg-brand-100" aria-hidden />
        <motion.div
          className="absolute left-3 top-[1.65rem] h-1.5 rounded-full bg-action"
          animate={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }}
          transition={{ duration: 0.4 }}
          aria-hidden
        />
        <ol className="relative flex justify-between">
          {events.map((e, n) => (
            <li key={`${e.label}-${n}`} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  go(n)
                }}
                aria-label={`${e.label} ${e.when}`}
                aria-current={n === i ? 'step' : undefined}
                className={`grid size-10 place-items-center rounded-full text-lg transition ${
                  n === i ? 'scale-125 bg-action text-white shadow-action' : n < i ? 'bg-brand-300 text-white' : 'bg-white ring-2 ring-brand-200'
                }`}
              >
                <span aria-hidden>{e.icon || '•'}</span>
              </button>
              <span className={`mt-2 text-center text-xs font-display sm:text-sm ${n === i ? 'text-brand-800' : 'text-slate-500'}`}>{e.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <input
        type="range"
        min={0}
        max={events.length - 1}
        value={i}
        aria-label="เลื่อนดูแต่ละช่วงเวลา"
        onChange={(e) => {
          setPlaying(false)
          go(Number(e.target.value))
        }}
        className="mt-3 w-full accent-[var(--color-action)]"
      />
      <div aria-live="polite" className="mt-2 min-h-24">
        <AnimatePresence mode="wait">
          {ev && (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-brand-100"
            >
              <span className="text-4xl" aria-hidden>
                {ev.icon}
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg text-brand-900">
                  {ev.label} {ev.when && <span className="text-sm text-slate-500">· {ev.when}</span>}
                </p>
                {ev.detail && <Markdown text={ev.detail} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && i >= events.length - 1) go(0)
            setPlaying(!playing)
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-action px-3 py-1.5 font-display text-sm text-white hover:bg-brand-600"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? 'หยุด' : 'เล่นอัตโนมัติ'}
        </button>
        <span className="text-sm text-slate-500">
          ดูแล้ว {seen.size}/{events.length} ช่วง{seen.size === events.length ? ' 🎉' : ''}
        </span>
      </div>
    </ActivityFrame>
  )
}

// ---------- กราฟแท่ง: ทายก่อนว่าแท่งไหนมากที่สุด แล้วดูแท่งงอกขึ้น ----------
export function BarsBlock({ prompt, unit, log, bars }: { prompt: string; unit: string; log: boolean; bars: { label: string; value: number; text: string }[] }) {
  const [guess, setGuess] = useState<number | null>(null)
  const [shown, setShown] = useState(false)
  const [round, setRound] = useState(0)
  const max = Math.max(...bars.map((b) => b.value))
  const min = Math.min(...bars.map((b) => b.value))
  const top = bars.findIndex((b) => b.value === max)
  const width = (v: number) => {
    if (max <= 0) return 0
    if (!log) return (v / max) * 100
    const lo = Math.log10(min) - 0.3
    return ((Math.log10(v) - lo) / (Math.log10(max) - lo)) * 100
  }
  const fmt = (v: number) => v.toLocaleString('th-TH', { maximumFractionDigits: 3 })
  return (
    <ActivityFrame badge="📊 ทายก่อนดูกราฟ — แตะแท่งที่คิดว่ามากที่สุด" tone="amber" prompt={prompt}>
      <ul className="flex flex-col gap-2.5">
        {bars.map((b, i) => (
          <li key={`${b.label}-${i}`}>
            <button
              type="button"
              disabled={shown}
              onClick={() => {
                setGuess(i)
                setShown(true)
              }}
              className={`grid w-full grid-cols-[minmax(5rem,9rem)_1fr] items-center gap-3 rounded-xl p-1 text-left transition enabled:hover:bg-amber-50 ${
                guess === i ? 'ring-2 ring-amber-400' : ''
              }`}
            >
              <span className="text-sm font-display text-ink">{b.label}</span>
              <span className="relative h-8 overflow-hidden rounded-lg bg-amber-100/60">
                <motion.span
                  key={round}
                  className={`absolute inset-y-0 left-0 rounded-lg ${i === top ? 'bg-gradient-to-r from-amber-400 to-coral-400' : 'bg-gradient-to-r from-brand-300 to-action'}`}
                  initial={{ width: 0 }}
                  animate={{ width: shown ? `${Math.max(width(b.value), 2)}%` : 0 }}
                  transition={{ duration: 0.9, delay: shown ? i * 0.15 : 0, ease: [0.16, 1, 0.3, 1] }}
                />
                {shown && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.15 }}
                    className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-ink sm:text-sm"
                  >
                    {b.text || `${fmt(b.value)} ${unit}`}
                  </motion.span>
                )}
                {!shown && <span className="absolute inset-0 grid place-items-center text-sm text-amber-700/70">?</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {log && shown && <p className="mt-2 text-xs text-slate-500">* ตัวเลขต่างกันมาก กราฟนี้ใช้สเกลลอการิทึม (แต่ละช่วงห่างกันเป็นเท่าตัว)</p>}
      <div aria-live="polite">
        {shown ? (
          <div className="tq-verdict mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-amber-200">
            <p className="font-display text-ink">
              {guess === null ? `มากที่สุดคือ ${bars[top]?.label}` : guess === top ? `🎯 ทายถูก! ${bars[top]?.label} มากที่สุด` : `🤔 ใกล้แล้ว — ที่จริง ${bars[top]?.label} มากที่สุด`}
            </p>
            <ResetButton
              label="ทายใหม่"
              onClick={() => {
                setShown(false)
                setGuess(null)
                setRound((r) => r + 1)
              }}
            />
          </div>
        ) : (
          <button type="button" onClick={() => setShown(true)} className="mt-3 text-sm text-slate-500 underline underline-offset-2">
            ไม่ทาย ดูกราฟเลย
          </button>
        )}
      </div>
    </ActivityFrame>
  )
}

