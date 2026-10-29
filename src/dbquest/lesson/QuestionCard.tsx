import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import type { Question } from '@/content/lesson'
import type { Json } from '@/lib/database.types'
import { checkAnswer, type CheckResult } from './dbqLessonApi'
import { DbqMarkdown } from './DbqMarkdown'
import { initialDraft, isDraftComplete, moveId, toggleChoice, type Draft } from './questionDraft'

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

// สถานะตัวเลือกนูน (.tq-choice): ตรวจแล้วตัวที่เลือกเป็นเขียว/แดง
type Verdict = 'right' | 'wrong' | null
const choiceState = (on: boolean, verdict: Verdict) => (on ? (verdict === 'right' ? 'correct' : verdict === 'wrong' ? 'wrong' : 'picked') : verdict ? 'dim' : 'idle')

function Inputs({ q, d, set, disabled, verdict }: { q: Question; d: Draft; set: (d: Draft) => void; disabled: boolean; verdict: Verdict }) {
  switch (q.type) {
    case 'mcq':
    case 'multi': {
      const multi = q.type === 'multi'
      const isOn = (i: number) => ('choices' in d ? d.choices.includes(i) : 'choice' in d && d.choice === i)
      return (
        <div role={multi ? 'group' : 'radiogroup'} className="flex flex-col gap-3">
          {multi && <p className="text-base text-slate-500 dark:text-dq-300">เลือกได้มากกว่า 1 ข้อ</p>}
          {q.choices.map((c, i) => (
            <button
              key={i}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={isOn(i)}
              disabled={disabled}
              onClick={() => set(multi && 'choices' in d ? { choices: toggleChoice(d.choices, i) } : { choice: i })}
              data-state={choiceState(isOn(i), verdict)}
              className="tq-choice flex min-h-14 items-center gap-3 px-4 py-3 text-left"
            >
              <span className="tq-choice-letter">{LETTERS[i]}</span>
              <span className="flex-1 leading-snug">{c}</span>
              {isOn(i) && verdict === 'right' && <span aria-hidden>✓</span>}
              {isOn(i) && verdict === 'wrong' && <span aria-hidden>✗</span>}
            </button>
          ))}
        </div>
      )
    }
    case 'fill':
      return (
        <input
          className="min-h-12 w-full rounded-2xl border-2 border-dq-200 bg-white px-4 py-3 outline-none focus:border-dq-500 dark:border-dq-700 dark:bg-dq-950"
          aria-label="คำตอบ"
          placeholder={q.placeholder ?? 'พิมพ์คำตอบ'}
          maxLength={200}
          disabled={disabled}
          value={'text' in d ? d.text : ''}
          onChange={(e) => set({ text: e.target.value })}
        />
      )
    case 'order': {
      const order = 'order' in d ? d.order : []
      const text = (id: string) => q.items.find((i) => i.id === id)?.text ?? id
      const move = (from: number, to: number) => set({ order: moveId(order, from, to) })
      return (
        <ol className="flex flex-col gap-2">
          {order.map((id, pos) => (
            <li key={id} className="flex items-center gap-2 rounded-2xl bg-white p-2 ring-2 ring-dq-100 dark:bg-dq-950 dark:ring-dq-800">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-dq-600 font-display text-white">{pos + 1}</span>
              <span className="flex-1">{text(id)}</span>
              <button type="button" disabled={disabled || pos === 0} onClick={() => move(pos, pos - 1)} aria-label={`เลื่อน "${text(id)}" ขึ้น`} className="grid size-11 place-items-center rounded-xl hover:bg-dq-100 disabled:opacity-30 dark:hover:bg-dq-800">
                ↑
              </button>
              <button type="button" disabled={disabled || pos === order.length - 1} onClick={() => move(pos, pos + 1)} aria-label={`เลื่อน "${text(id)}" ลง`} className="grid size-11 place-items-center rounded-xl hover:bg-dq-100 disabled:opacity-30 dark:hover:bg-dq-800">
                ↓
              </button>
            </li>
          ))}
        </ol>
      )
    }
    case 'match': {
      const pairs = 'pairs' in d ? d.pairs : {}
      return (
        <ul className="flex flex-col gap-3">
          {q.left.map((l) => (
            <li key={l.id} className="grid gap-2 rounded-2xl bg-dq-50 p-3 sm:grid-cols-2 sm:items-center dark:bg-dq-900">
              <span className="font-display">{l.text}</span>
              <select
                className="min-h-11 w-full rounded-xl border-2 border-dq-200 bg-white px-3 py-2 dark:border-dq-700 dark:bg-dq-950"
                aria-label={`จับคู่กับ ${l.text}`}
                disabled={disabled}
                value={pairs[l.id] ?? ''}
                onChange={(e) => set({ pairs: { ...pairs, [l.id]: e.target.value } })}
              >
                <option value="">— เลือกความหมาย —</option>
                {q.right.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.text}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )
    }
    case 'classify': {
      const pairs = 'pairs' in d ? d.pairs : {}
      return (
        <ul className="flex flex-col gap-3">
          {q.items.map((it) => (
            <li key={it.id} className="rounded-2xl bg-dq-50 p-3 dark:bg-dq-900">
              <p className="mb-2 font-display">{it.text}</p>
              <div role="radiogroup" aria-label={`กลุ่มของ ${it.text}`} className="flex flex-wrap gap-2">
                {q.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={pairs[it.id] === c.id}
                    disabled={disabled}
                    onClick={() => set({ pairs: { ...pairs, [it.id]: c.id } })}
                    data-state={pairs[it.id] === c.id ? 'picked' : 'idle'}
                    className="tq-choice min-h-11 px-4"
                  >
                    {c.text}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )
    }
  }
}

interface Props {
  question: Question
  solved: boolean
  onChecked: (itemId: string, r: CheckResult) => void
}

// คำถาม 1 ข้อ: ตอบ -> ส่งให้เซิร์ฟเวอร์ตรวจ -> ได้แค่ ถูก/ผิด + คำใบ้ (ตอบใหม่ได้เรื่อย ๆ)
// ปรนัยตัวเลือกเดียว: แตะตัวเลือก = ตรวจทันที · แบบอื่นกดปุ่มตรวจคำตอบ
export function QuestionCard({ question, solved, onChecked }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(question))
  const [result, setResult] = useState<CheckResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const done = solved || result?.correct === true
  const onCheck = async (d: Draft = draft) => {
    setBusy(true)
    setError(null)
    try {
      const r = await checkAnswer(question.id, d as Json)
      setResult(r)
      onChecked(question.id, r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ตรวจไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-3xl bg-gradient-to-b from-white to-dq-50/70 p-4 shadow-[0_2px_4px_rgb(20_45_100/0.06),0_18px_36px_-20px_rgb(20_45_100/0.4)] ring-1 ring-dq-100 sm:p-5 dark:from-dq-900 dark:to-dq-950 dark:ring-dq-800">
      <div className="font-display text-lg text-dq-900 dark:text-white">
        <DbqMarkdown text={question.prompt} />
      </div>
      <Inputs
        q={question}
        d={draft}
        set={(d) => {
          setDraft(d)
          if (result && !result.correct) setResult(null)
          if (question.type === 'mcq' && !done && !busy) void onCheck(d)
        }}
        disabled={done || busy}
        verdict={done ? 'right' : result ? 'wrong' : null}
      />
      <div aria-live="polite">
        {done ? (
          <p className="tq-verdict flex items-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-50 to-mint-400/25 px-4 py-3 font-display text-emerald-800 shadow-sm ring-2 ring-mint-500 dark:from-emerald-950/60 dark:to-emerald-900/40 dark:text-emerald-200">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-mint-400 to-mint-500 text-white shadow-md" aria-hidden>
              ✓
            </span>
            ถูกต้อง! 🎉{result && result.xp > 0 && ` · +${result.xp} XP`}
          </p>
        ) : result ? (
          <div className="tq-verdict flex gap-3 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 px-4 py-3 text-rose-900 shadow-sm ring-2 ring-coral-400 dark:from-rose-950/60 dark:to-rose-900/40 dark:text-rose-100">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-coral-400 to-rose-600 text-white shadow-md" aria-hidden>
              ✗
            </span>
            <div className="min-w-0">
              <p className="font-display">ยังไม่ถูก</p>
              {result.hint && <p className="mt-1 flex gap-1.5"><Lightbulb className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden /> {result.hint}</p>}
            </div>
          </div>
        ) : null}
        {error && <p className="text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
      {!done && question.type !== 'mcq' && (
        <button
          type="button"
          onClick={() => void onCheck()}
          disabled={busy || !isDraftComplete(question, draft)}
          className="min-h-12 rounded-2xl bg-dq-600 px-6 font-display text-white hover:bg-dq-700 disabled:opacity-50"
        >
          {busy ? 'กำลังตรวจ…' : 'ตรวจคำตอบ'}
        </button>
      )}
    </div>
  )
}
