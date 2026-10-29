import { useMemo } from 'react'
import { Markdown } from '@/features/lessons/Markdown'
import { initialOrder, moveItem, parseAnswer, seededOrder, type Answer, type ExamQuestion, type Feedback } from './examModel'

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

interface Props {
  question: ExamQuestion
  answer: Answer | undefined
  onChange: (a: Answer) => void
  shuffleSeed: string | null // null = ไม่สลับตัวเลือก
  disabled?: boolean
  feedback?: Feedback | null // ตรวจแล้ว: แสดงถูก/ผิดบนตัวเลือก และล็อกคำตอบ
}

type ChoiceState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim'

// สถานะตัวเลือก: ก่อนตรวจ = เลือกอยู่/ไม่เลือก · หลังตรวจ = ข้อที่ถูกเขียว ข้อที่เลือกผิดแดง ที่เหลือจาง
function choiceState(isPicked: boolean, isCorrect: boolean | null): ChoiceState {
  if (isCorrect === null) return isPicked ? 'picked' : 'idle'
  if (isCorrect) return 'correct'
  return isPicked ? 'wrong' : 'dim'
}

// ช่องตอบตามประเภทคำถาม — ส่งดัชนีตามลำดับใน DB เสมอ แม้หน้าจอจะสลับตัวเลือก
export function QuestionInput({ question, answer, onChange, shuffleSeed, disabled, feedback }: Props) {
  const choices = Array.isArray(question.choices) ? question.choices : []
  const display = useMemo(
    () => (shuffleSeed ? seededOrder(choices.length, `${shuffleSeed}:${question.id}`) : choices.map((_, i) => i)),
    [choices, question.id, shuffleSeed],
  )
  const key = feedback ? parseAnswer(feedback.correct) : null
  const locked = disabled || !!feedback
  const right = feedback ? (feedback.points ?? 0) >= 1 : null

  switch (question.type) {
    case 'mcq': {
      const selected = answer && 'index' in answer ? answer.index : null
      const correctIdx = key && 'index' in key ? key.index : null
      return (
        <div role="radiogroup" className="flex flex-col gap-3">
          {display.map((orig, pos) => (
            <button
              key={orig}
              type="button"
              role="radio"
              aria-checked={selected === orig}
              disabled={locked}
              data-state={choiceState(selected === orig, feedback ? orig === correctIdx : null)}
              onClick={() => onChange({ index: orig })}
              className="tq-choice flex min-h-14 items-center gap-3 px-4 py-3 text-left"
            >
              <span className="tq-choice-letter">{LETTERS[pos]}</span>
              <span className="flex-1 leading-snug">{choices[orig]}</span>
              {feedback && orig === correctIdx && <span aria-label="คำตอบที่ถูก">✓</span>}
              {feedback && selected === orig && orig !== correctIdx && <span aria-label="คำตอบที่เลือก (ผิด)">✗</span>}
            </button>
          ))}
        </div>
      )
    }
    case 'true_false': {
      const v = answer && 'value' in answer ? answer.value : null
      const correctV = key && 'value' in key ? key.value : null
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
              disabled={locked}
              data-state={choiceState(v === o.value, feedback ? o.value === correctV : null)}
              onClick={() => onChange({ value: o.value })}
              className="tq-choice min-h-16 px-4 py-4 font-display text-lg"
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
      const ring = right === null ? 'border-brand-200 focus:border-brand-500' : right ? 'border-mint-500 bg-mint-400/10' : 'border-coral-400 bg-rose-50'
      return question.type === 'fill' ? (
        <input
          className={`w-full rounded-2xl border-2 bg-white px-4 py-3 text-lg shadow-[inset_0_2px_4px_rgb(20_45_100/0.08)] outline-none ${ring}`}
          aria-label="คำตอบ"
          placeholder="พิมพ์คำตอบ"
          maxLength={200}
          disabled={locked}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      ) : (
        <textarea
          className="min-h-36 w-full rounded-2xl border-2 border-brand-200 bg-white px-4 py-3 shadow-[inset_0_2px_4px_rgb(20_45_100/0.08)] outline-none focus:border-brand-500"
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
      const keyPairs = key && 'pairs' in key ? key.pairs : null
      return (
        <ul className="flex flex-col gap-3">
          {m.left.map((l, i) => {
            const ok = keyPairs ? pairs[i] === keyPairs[i] : null
            return (
              <li
                key={l}
                className={`grid gap-2 rounded-2xl p-3 shadow-sm ring-2 sm:grid-cols-2 sm:items-center ${
                  ok === null ? 'bg-brand-50 ring-brand-100' : ok ? 'bg-mint-400/15 ring-mint-500' : 'bg-rose-50 ring-coral-400'
                }`}
              >
                <span className="font-display text-slate-800">{l}</span>
                <div>
                  <select
                    className="w-full rounded-xl border-2 border-brand-200 bg-white px-3 py-2"
                    aria-label={`จับคู่กับ ${l}`}
                    disabled={locked}
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
                  {ok === false && keyPairs?.[i] != null && (
                    <p className="mt-1 text-sm text-emerald-800">ที่ถูก: {m.right[keyPairs[i] as number]}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )
    }
    case 'ordering': {
      const order = answer && 'order' in answer ? answer.order : initialOrder(question)
      const keyOrder = key && 'order' in key ? key.order : null
      const move = (from: number, to: number) => onChange({ order: moveItem(order, from, to) })
      return (
        <ol className="flex flex-col gap-2">
          {order.map((orig, pos) => {
            const ok = keyOrder ? keyOrder[pos] === orig : null
            return (
              <li
                key={orig}
                className={`flex items-center gap-2 rounded-2xl p-2 shadow-sm ring-2 ${
                  ok === null ? 'bg-white ring-brand-100' : ok ? 'bg-mint-400/15 ring-mint-500' : 'bg-rose-50 ring-coral-400'
                }`}
              >
                <span className="tq-choice-letter">{pos + 1}</span>
                <span className="flex-1">{choices[orig]}</span>
                {!locked && (
                  <>
                    <button type="button" disabled={pos === 0} onClick={() => move(pos, pos - 1)} aria-label="เลื่อนขึ้น" className="grid size-10 place-items-center rounded-xl hover:bg-brand-100 disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" disabled={pos === order.length - 1} onClick={() => move(pos, pos + 1)} aria-label="เลื่อนลง" className="grid size-10 place-items-center rounded-xl hover:bg-brand-100 disabled:opacity-30">
                      ↓
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      )
    }
  }
}

export function QuestionPrompt({ no, prompt }: { no: number; prompt: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-action to-action-strong font-display text-lg text-white shadow-action">
        {no}
      </span>
      <div className="min-w-0 flex-1 pt-1.5 text-lg font-semibold leading-relaxed text-ink">
        <Markdown text={prompt} />
      </div>
    </div>
  )
}
