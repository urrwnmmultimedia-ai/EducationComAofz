import { useMemo } from 'react'
import { Markdown } from '@/features/lessons/Markdown'
import { initialOrder, moveItem, seededOrder, type Answer, type ExamQuestion } from './examModel'

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

interface Props {
  question: ExamQuestion
  answer: Answer | undefined
  onChange: (a: Answer) => void
  shuffleSeed: string | null // null = ไม่สลับตัวเลือก
  disabled?: boolean
}

// ช่องตอบตามประเภทคำถาม — ส่งดัชนีตามลำดับใน DB เสมอ แม้หน้าจอจะสลับตัวเลือก
export function QuestionInput({ question, answer, onChange, shuffleSeed, disabled }: Props) {
  const choices = Array.isArray(question.choices) ? question.choices : []
  const display = useMemo(
    () => (shuffleSeed ? seededOrder(choices.length, `${shuffleSeed}:${question.id}`) : choices.map((_, i) => i)),
    [choices, question.id, shuffleSeed],
  )

  switch (question.type) {
    case 'mcq': {
      const selected = answer && 'index' in answer ? answer.index : null
      return (
        <div role="radiogroup" className="flex flex-col gap-2">
          {display.map((orig, pos) => (
            <button
              key={orig}
              type="button"
              role="radio"
              aria-checked={selected === orig}
              disabled={disabled}
              onClick={() => onChange({ index: orig })}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition ${
                selected === orig ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-brand-100 hover:ring-brand-300'
              }`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-full font-display ${selected === orig ? 'bg-white text-brand-700' : 'bg-brand-100 text-brand-700'}`}>
                {LETTERS[pos]}
              </span>
              <span className="pt-0.5">{choices[orig]}</span>
            </button>
          ))}
        </div>
      )
    }
    case 'true_false': {
      const v = answer && 'value' in answer ? answer.value : null
      return (
        <div role="radiogroup" className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: '✓ ถูก' },
            { value: false, label: '✗ ผิด' },
          ].map((o) => (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={v === o.value}
              disabled={disabled}
              onClick={() => onChange({ value: o.value })}
              className={`rounded-2xl px-4 py-4 font-display text-lg ring-2 ${
                v === o.value ? (o.value ? 'bg-mint-500 text-white ring-mint-500' : 'bg-coral-400 text-white ring-coral-400') : 'bg-white ring-brand-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )
    }
    case 'fill':
    case 'short': {
      const text = answer && 'text' in answer ? answer.text : ''
      return question.type === 'fill' ? (
        <input
          className="w-full rounded-2xl border-2 border-brand-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-500"
          aria-label="คำตอบ"
          placeholder="พิมพ์คำตอบ"
          maxLength={200}
          disabled={disabled}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      ) : (
        <textarea
          className="min-h-36 w-full rounded-2xl border-2 border-brand-200 bg-white px-4 py-3 outline-none focus:border-brand-500"
          aria-label="คำตอบ"
          placeholder="พิมพ์คำตอบ (ครูจะตรวจข้อนี้เอง)"
          maxLength={2000}
          disabled={disabled}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )
    }
    case 'matching': {
      const m = Array.isArray(question.choices) ? { left: [], right: [] } : question.choices
      const pairs = answer && 'pairs' in answer ? answer.pairs : m.left.map(() => null)
      return (
        <ul className="flex flex-col gap-3">
          {m.left.map((l, i) => (
            <li key={l} className="grid gap-2 rounded-2xl bg-brand-50 p-3 sm:grid-cols-2 sm:items-center">
              <span className="font-display text-slate-800">{l}</span>
              <select
                className="w-full rounded-xl border-2 border-brand-200 bg-white px-3 py-2"
                aria-label={`จับคู่กับ ${l}`}
                disabled={disabled}
                value={pairs[i] ?? ''}
                onChange={(e) => {
                  const next = [...pairs]
                  while (next.length < m.left.length) next.push(null)
                  next[i] = e.target.value === '' ? null : Number(e.target.value)
                  onChange({ pairs: next })
                }}
              >
                <option value="">— เลือกคำตอบ —</option>
                {m.right.map((r, j) => (
                  <option key={r} value={j}>
                    {r}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )
    }
    case 'ordering': {
      const order = answer && 'order' in answer ? answer.order : initialOrder(question)
      const move = (from: number, to: number) => onChange({ order: moveItem(order, from, to) })
      return (
        <ol className="flex flex-col gap-2">
          {order.map((orig, pos) => (
            <li key={orig} className="flex items-center gap-2 rounded-2xl bg-white p-2 ring-2 ring-brand-100">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 font-display text-white">{pos + 1}</span>
              <span className="flex-1">{choices[orig]}</span>
              <button type="button" disabled={disabled || pos === 0} onClick={() => move(pos, pos - 1)} aria-label="เลื่อนขึ้น" className="grid size-9 place-items-center rounded-xl hover:bg-brand-100 disabled:opacity-30">
                ↑
              </button>
              <button type="button" disabled={disabled || pos === order.length - 1} onClick={() => move(pos, pos + 1)} aria-label="เลื่อนลง" className="grid size-9 place-items-center rounded-xl hover:bg-brand-100 disabled:opacity-30">
                ↓
              </button>
            </li>
          ))}
        </ol>
      )
    }
  }
}

export function QuestionPrompt({ no, prompt }: { no: number; prompt: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 font-display text-brand-700">{no}</span>
      <div className="min-w-0 flex-1 pt-1 text-lg">
        <Markdown text={prompt} />
      </div>
    </div>
  )
}
