import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { Doctor } from '@/components/characters/Characters'
import { EmptyBlock } from '@/components/StatusViews'
import { Markdown } from './Markdown'
import { splitCards, type Segment } from './lessonFormat'

export function SegmentView({ segment, onSolved, solved }: { segment: Segment; onSolved?: () => void; solved?: boolean }) {
  switch (segment.kind) {
    case 'markdown':
      return <Markdown text={segment.text} />
    case 'tip':
      return (
        <aside className="my-4 rounded-2xl bg-sun-300/40 p-4 ring-1 ring-sun-400/60">
          <p className="mb-1 font-display text-amber-800">💡 เกร็ดน่ารู้</p>
          <Markdown text={segment.text} />
        </aside>
      )
    case 'doctor':
      return (
        <aside className="my-4 flex gap-3 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200">
          <Doctor className="size-14 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-sky-800">ด็อกเตอร์อธิบาย</p>
            <Markdown text={segment.text} />
          </div>
        </aside>
      )
    case 'example':
      return (
        <aside className="my-4 rounded-2xl bg-mint-400/15 p-4 ring-1 ring-mint-400/50">
          <p className="mb-1 font-display text-emerald-800">📌 ตัวอย่างใกล้ตัว</p>
          <Markdown text={segment.text} />
        </aside>
      )
    case 'think':
      return <ThinkBox question={segment.question} answer={segment.answer} />
    case 'check':
      return (
        <CheckBox
          question={segment.question}
          choices={segment.choices}
          correct={segment.correct}
          explain={segment.explain}
          onSolved={onSolved}
          initialSolved={solved}
        />
      )
    case 'embed':
      return segment.embedUrl ? (
        <div className="my-4 aspect-video overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-brand-100">
          <iframe
            src={segment.embedUrl}
            title="สื่อประกอบบทเรียน"
            className="size-full"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <p className="my-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          ลิงก์สื่อนี้ฝังไม่ได้ (รองรับเฉพาะ YouTube และ Canva):{' '}
          <a className="underline" href={segment.url} target="_blank" rel="noopener noreferrer">
            เปิดลิงก์
          </a>
        </p>
      )
  }
}

// กล่อง "ลองคิดดู": ให้นักเรียนคิดก่อน แล้วค่อยกดดูแนวคิด
function ThinkBox({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <aside className="my-4 rounded-2xl bg-brand-100/70 p-4 ring-1 ring-brand-300">
      <p className="mb-1 font-display text-brand-800">🤔 ลองคิดดู</p>
      <Markdown text={question} />
      {answer && (
        <div className="mt-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="rounded-xl bg-white px-3 py-1.5 font-display text-sm text-brand-700 ring-1 ring-brand-300 hover:bg-brand-50"
          >
            {open ? 'ซ่อนแนวคิด' : 'คิดแล้ว ดูแนวคิด →'}
          </button>
          {open && (
            <div className="mt-2 rounded-xl bg-white p-3">
              <Markdown text={answer} />
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

// เช็กความเข้าใจท้ายการ์ด: แตะตัวเลือก = ตอบเลย รู้ทันทีว่าถูกหรือผิด · ผิดลองใหม่ได้ (ต้องถูกจึงไปการ์ดถัดไป) ไม่เก็บคะแนน
function CheckBox({
  question,
  choices,
  correct,
  explain,
  onSolved,
  initialSolved = false,
}: {
  question: string
  choices: string[]
  correct: number
  explain: string
  onSolved?: () => void
  initialSolved?: boolean // ตอบถูกไปแล้ว (ย้อนกลับมาดูการ์ดเดิม)
}) {
  const [picked, setPicked] = useState<number | null>(initialSolved ? correct : null)
  // นับครั้งที่ตอบ ใช้เล่นท่าสั่นซ้ำเมื่อเลือกผิดอีกครั้ง
  const [tries, setTries] = useState(0)
  const solved = picked === correct

  const answer = (i: number) => {
    if (solved) return
    setPicked(i)
    setTries((n) => n + 1)
    if (i === correct) onSolved?.()
  }

  return (
    <aside className="my-4 rounded-3xl bg-gradient-to-b from-amber-50/80 to-white p-4 shadow-sm ring-1 ring-amber-200/70 sm:p-5">
      <p className="mb-2 font-display text-amber-700">✅ เช็กความเข้าใจ</p>
      <div className="font-semibold text-ink">
        <Markdown text={question} />
      </div>
      <div role="radiogroup" className="mt-3 flex flex-col gap-3">
        {choices.map((c, i) => {
          const state = picked === null ? 'idle' : solved ? (i === correct ? 'correct' : 'dim') : picked === i ? 'wrong' : 'idle'
          return (
            <button
              key={picked === i ? `${i}-${tries}` : i}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={solved}
              data-state={state}
              onClick={() => answer(i)}
              className="tq-choice flex min-h-12 items-center gap-3 px-4 py-2.5 text-left"
            >
              <span className="tq-choice-letter">{'กขคงจฉ'[i]}</span>
              <span className="flex-1">{c}</span>
              {state === 'correct' && <span aria-hidden>✓</span>}
              {state === 'wrong' && <span aria-hidden>✗</span>}
            </button>
          )
        })}
      </div>
      <div aria-live="polite">
        {picked !== null && !solved && (
          <p className="tq-verdict mt-3 rounded-2xl bg-rose-50 px-4 py-2.5 font-display text-rose-700 ring-1 ring-coral-400/60">
            ✗ ยังไม่ถูก ลองอ่านการ์ดอีกครั้งแล้วเลือกใหม่นะ
          </p>
        )}
        {solved && (
          <div className="tq-verdict mt-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-mint-400/20 p-3 shadow-sm ring-2 ring-mint-500">
            <p className="font-display text-emerald-800">✓ ถูกต้อง! 🎉</p>
            {explain && <Markdown text={explain} />}
          </div>
        )}
      </div>
    </aside>
  )
}

// แสดงเนื้อหาเป็นการ์ดทีละใบ (เหมือนสไลด์) พร้อมปุ่มก่อนหน้า/ถัดไป
// locked: ต้องตอบเช็กความเข้าใจของการ์ดให้ถูกก่อน จึงไปการ์ดถัดไปหรือกดอ่านครบได้
export function LessonCards({
  title,
  markdown,
  onFinished,
  locked = false,
}: {
  title: string
  markdown: string
  onFinished?: () => void
  locked?: boolean
}) {
  const cards = useMemo(() => splitCards(markdown, title), [markdown, title])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  // เช็กความเข้าใจที่ตอบถูกแล้ว เก็บเป็น "การ์ด:ช่อง"
  const [solved, setSolved] = useState<ReadonlySet<string>>(() => new Set())
  // ตอบเช็กความเข้าใจถูก รอให้เห็นเฉลยสักครู่แล้วไปการ์ดถัดไป
  const [advanceFrom, setAdvanceFrom] = useState<number | null>(null)
  useEffect(() => {
    if (advanceFrom === null) return
    const t = setTimeout(() => {
      setAdvanceFrom(null)
      setDirection(1)
      setIndex((i) => (i === advanceFrom ? Math.min(i + 1, cards.length - 1) : i))
    }, 1500)
    return () => clearTimeout(t)
  }, [advanceFrom, cards.length])

  if (cards.length === 0) return <EmptyBlock>ครูยังไม่ได้ใส่เนื้อหาคาบนี้</EmptyBlock>

  const safeIndex = Math.min(index, cards.length - 1)
  const card = cards[safeIndex]
  if (!card) return null
  const isLast = safeIndex === cards.length - 1
  const cardDone = (i: number) => (cards[i]?.segments ?? []).every((seg, j) => seg.kind !== 'check' || solved.has(`${i}:${j}`))
  // การ์ดที่ไปถึงได้: ทุกการ์ดก่อนหน้าตอบเช็กความเข้าใจถูกครบแล้ว
  const reachable = (i: number) => !locked || cards.slice(0, i).every((_, j) => cardDone(j))
  const canLeave = !locked || cardDone(safeIndex)

  const go = (next: number) => {
    if (!reachable(next)) return
    setDirection(next > safeIndex ? 1 : -1)
    setIndex(next)
  }
  const onSolved = (seg: number) => {
    setSolved((s) => new Set(s).add(`${safeIndex}:${seg}`))
    if (!isLast) setAdvanceFrom(safeIndex)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" aria-label="การ์ดเนื้อหา">
        {cards.map((c, i) => (
          <button
            key={`${c.title}-${i}`}
            type="button"
            onClick={() => go(i)}
            disabled={!reachable(i)}
            aria-label={`การ์ดที่ ${i + 1}: ${c.title}${reachable(i) ? '' : ' (ยังล็อก)'}`}
            aria-current={i === safeIndex ? 'step' : undefined}
            className={`h-2.5 rounded-full transition-all disabled:cursor-not-allowed ${
              i === safeIndex ? 'w-8 bg-brand-600' : i < safeIndex ? 'w-2.5 bg-brand-300' : 'w-2.5 bg-brand-100'
            }`}
          />
        ))}
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.article
            key={safeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.2 }}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100 sm:p-7"
          >
            <p className="text-sm text-brand-500">
              การ์ด {safeIndex + 1} / {cards.length}
            </p>
            <h2 className="mb-2 text-xl text-brand-900 sm:text-2xl">{card.title}</h2>
            {card.segments.map((seg, i) => (
              <SegmentView key={i} segment={seg} solved={solved.has(`${safeIndex}:${i}`)} onSolved={() => onSolved(i)} />
            ))}
          </motion.article>
        </AnimatePresence>
      </div>

      {!canLeave && <p className="text-center text-sm text-amber-700">ตอบเช็กความเข้าใจของการ์ดนี้ให้ถูกก่อน จึงไปต่อได้</p>}
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" disabled={safeIndex === 0} onClick={() => go(safeIndex - 1)}>
          ← ก่อนหน้า
        </Button>
        {isLast ? (
          onFinished && (
            <Button disabled={!canLeave} onClick={onFinished}>
              อ่านครบแล้ว ✓
            </Button>
          )
        ) : (
          <Button disabled={!canLeave} onClick={() => go(safeIndex + 1)}>
            ถัดไป →
          </Button>
        )}
      </div>
    </div>
  )
}
