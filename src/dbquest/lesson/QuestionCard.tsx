import { useState } from 'react'
import type { Question } from '@/content/lesson'
import type { Json } from '@/lib/database.types'
import { checkAnswer, type CheckResult } from './dbqLessonApi'
import { DbqMarkdown } from './DbqMarkdown'
import { initialDraft, isDraftComplete, moveId, toggleChoice, type Draft } from './questionDraft'

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']

const pick = (on: boolean) =>
  on
    ? 'bg-dq-600 text-white ring-dq-600'
    : 'bg-white ring-dq-100 hover:ring-dq-300 dark:bg-dq-950 dark:ring-dq-800 dark:hover:ring-dq-600'

function Inputs({ q, d, set, disabled }: { q: Question; d: Draft; set: (d: Draft) => void; disabled: boolean }) {
  switch (q.type) {
    case 'mcq':
    case 'multi': {
      const multi = q.type === 'multi'
      const isOn = (i: number) => ('choices' in d ? d.choices.includes(i) : 'choice' in d && d.choice === i)
      return (
        <div role={multi ? 'group' : 'radiogroup'} className="flex flex-col gap-2">
          {multi && <p className="text-base text-slate-500 dark:text-dq-300">เลือกได้มากกว่า 1 ข้อ</p>}
          {q.choices.map((c, i) => (
            <button
              key={i}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={isOn(i)}
              disabled={disabled}
              onClick={() => set(multi && 'choices' in d ? { choices: toggleChoice(d.choices, i) } : { choice: i })}
              className={`flex min-h-12 items-start gap-3 rounded-2xl px-4 py-3 text-left ring-2 transition disabled:cursor-default ${pick(isOn(i))}`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-dq-100 font-display text-dq-700">{LETTERS[i]}</span>
              <span className="pt-0.5">{c}</span>
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
                    className={`min-h-11 rounded-xl px-4 ring-2 transition ${pick(pairs[it.id] === c.id)}`}
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
export function QuestionCard({ question, solved, onChecked }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(question))
  const [result, setResult] = useState<CheckResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const done = solved || result?.correct === true
  const onCheck = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await checkAnswer(question.id, draft as Json)
      setResult(r)
      onChecked(question.id, r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ตรวจไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-3xl bg-white p-4 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800">
      <div className="font-display text-dq-900 dark:text-white">
        <DbqMarkdown text={question.prompt} />
      </div>
      <Inputs
        q={question}
        d={draft}
        set={(d) => {
          setDraft(d)
          if (result && !result.correct) setResult(null)
        }}
        disabled={done || busy}
      />
      <div aria-live="polite">
        {done ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 font-display text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            ✓ ถูกต้อง{result && result.xp > 0 && ` · +${result.xp} XP`}
          </p>
        ) : result ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            <p className="font-display">ยังไม่ถูก ลองใหม่อีกครั้งนะ</p>
            {result.hint && <p className="mt-1">💡 {result.hint}</p>}
          </div>
        ) : null}
        {error && <p className="text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
      {!done && (
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
