import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { Doctor } from '@/components/characters/Characters'
import { EmptyBlock } from '@/components/StatusViews'
import { Markdown } from './Markdown'
import { splitCards, type Segment } from './lessonFormat'

export function SegmentView({ segment, onSolved }: { segment: Segment; onSolved?: () => void }) {
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
      return <CheckBox question={segment.question} choices={segment.choices} correct={segment.correct} explain={segment.explain} onSolved={onSolved} />
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

// เช็กความเข้าใจท้ายการ์ด (แบบ DB Quest): เลือกคำตอบแล้วกดตรวจ ตอบผิดลองใหม่ได้ ไม่เก็บคะแนน
function CheckBox({
  question,
  choices,
  correct,
  explain,
  onSolved,
}: {
  question: string
  choices: string[]
  correct: number
  explain: string
  onSolved?: () => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<'right' | 'wrong' | null>(null)
  const solved = result === 'right'

  const check = () => {
    if (picked === null) return
    const right = picked === correct
    setResult(right ? 'right' : 'wrong')
    if (right) onSolved?.()
  }

  return (
    <aside className="my-4 rounded-2xl border-t border-brand-100 pt-4">
      <p className="mb-2 font-display text-amber-700">✅ เช็กความเข้าใจ</p>
      <Markdown text={question} />
      <div role="radiogroup" className="mt-3 flex flex-col gap-2">
        {choices.map((c, i) => {
          const isPicked = picked === i
          const tone =
            solved && i === correct
              ? 'bg-mint-400/20 ring-2 ring-mint-500'
              : isPicked && result === 'wrong'
                ? 'bg-rose-50 ring-2 ring-rose-300'
                : isPicked
                  ? 'bg-brand-50 ring-2 ring-brand-500'
                  : 'bg-white ring-1 ring-brand-200 hover:bg-brand-50'
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={solved}
              onClick={() => {
                setPicked(i)
                setResult(null)
              }}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 text-left transition ${tone}`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 font-display text-sm text-brand-800">
                {'กขคงจฉ'[i]}
              </span>
              <span>{c}</span>
            </button>
          )
        })}
      </div>
      {result === 'wrong' && <p className="mt-3 text-rose-700">ยังไม่ใช่ ลองอ่านการ์ดอีกครั้งแล้วเลือกใหม่นะ</p>}
      {solved && (
        <div className="mt-3 rounded-xl bg-mint-400/15 p-3">
          <p className="font-display text-emerald-800">ถูกต้อง! 🎉</p>
          {explain && <Markdown text={explain} />}
        </div>
      )}
      {!solved && (
        <Button className="mt-3" variant="secondary" disabled={picked === null || result === 'wrong'} onClick={check}>
          ตรวจคำตอบ
        </Button>
      )}
    </aside>
  )
}

// แสดงเนื้อหาเป็นการ์ดทีละใบ (เหมือนสไลด์) พร้อมปุ่มก่อนหน้า/ถัดไป
export function LessonCards({ title, markdown, onFinished }: { title: string; markdown: string; onFinished?: () => void }) {
  const cards = useMemo(() => splitCards(markdown, title), [markdown, title])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  // ตอบเช็กความเข้าใจถูก รอให้เห็นเฉลยสักครู่แล้วไปการ์ดถัดไป (ปุ่มก่อนหน้า/ถัดไปกดได้ตลอด ไม่ล็อกการ์ด)
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

  const go = (next: number) => {
    setDirection(next > safeIndex ? 1 : -1)
    setIndex(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" aria-label="การ์ดเนื้อหา">
        {cards.map((c, i) => (
          <button
            key={`${c.title}-${i}`}
            type="button"
            onClick={() => go(i)}
            aria-label={`การ์ดที่ ${i + 1}: ${c.title}`}
            aria-current={i === safeIndex ? 'step' : undefined}
            className={`h-2.5 rounded-full transition-all ${
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
              <SegmentView key={i} segment={seg} onSolved={isLast ? undefined : () => setAdvanceFrom(safeIndex)} />
            ))}
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" disabled={safeIndex === 0} onClick={() => go(safeIndex - 1)}>
          ← ก่อนหน้า
        </Button>
        {isLast ? (
          onFinished && <Button onClick={onFinished}>อ่านครบแล้ว ✓</Button>
        ) : (
          <Button onClick={() => go(safeIndex + 1)}>ถัดไป →</Button>
        )}
      </div>
    </div>
  )
}
