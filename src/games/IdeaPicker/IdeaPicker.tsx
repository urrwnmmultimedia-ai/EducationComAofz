import { useState } from 'react'
import { Button } from '@/components/Button'
import { gradeIdea } from '@/games/shared/logic'
import type { IdeaConfig } from '@/games/shared/schemas'
import type { GameProps } from '@/games/shared/types'

// Idea Picker: ให้คะแนนแนวคิดตามเกณฑ์ เลือกแนวคิดที่ดีที่สุดพร้อมเหตุผล
export function IdeaPicker({ config, onFinish, sfx }: GameProps<IdeaConfig>) {
  const [ratings, setRatings] = useState<number[][]>(() => config.ideas.map(() => config.criteria.map(() => 0)))
  const [idea, setIdea] = useState<number | null>(null)
  const [reason, setReason] = useState<number | null>(null)
  const filled = ratings.every((r) => r.every((v) => v > 0))
  const sums = ratings.map((r) => r.reduce((a, b) => a + b, 0))

  const submit = () => {
    const g = gradeIdea(config, ratings, idea, reason)
    if (g.correct / g.total >= 0.8) sfx.correct()
    else sfx.wrong()
    onFinish(g)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-sky-50 p-3 text-sky-950 ring-1 ring-sky-200">🎯 ปัญหา: {config.problem}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left font-display text-brand-900">แนวคิด</th>
              {config.criteria.map((c) => (
                <th key={c} className="p-2 font-display text-brand-900">
                  {c}
                </th>
              ))}
              <th className="p-2 font-display text-brand-900">รวม</th>
            </tr>
          </thead>
          <tbody>
            {config.ideas.map((it, i) => (
              <tr key={it.name}>
                <td className="rounded-xl bg-brand-50 p-2 align-top">
                  <p className="font-display text-slate-800">{it.name}</p>
                  <p className="text-xs text-slate-600">{it.desc}</p>
                </td>
                {config.criteria.map((c, k) => (
                  <td key={c} className="p-1 text-center">
                    <div className="inline-flex gap-1" role="radiogroup" aria-label={`${it.name} ${c}`}>
                      {[1, 2, 3].map((v) => (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={ratings[i]?.[k] === v}
                          onClick={() => setRatings(ratings.map((row, ri) => (ri === i ? row.map((x, ci) => (ci === k ? v : x)) : row)))}
                          className={`size-8 rounded-lg font-display ${ratings[i]?.[k] === v ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-brand-200'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </td>
                ))}
                <td className="text-center font-display text-brand-700">{sums[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="rounded-2xl bg-brand-50 p-3">
          <legend className="font-display text-brand-900">แนวคิดที่ดีที่สุด</legend>
          {config.ideas.map((it, i) => (
            <label key={it.name} className="mt-1 flex items-center gap-2">
              <input type="radio" name="idea" className="size-4 accent-brand-600" checked={idea === i} onChange={() => setIdea(i)} />
              {it.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="rounded-2xl bg-brand-50 p-3">
          <legend className="font-display text-brand-900">เหตุผล</legend>
          {config.reasons.map((r, i) => (
            <label key={r.text} className="mt-1 flex items-start gap-2">
              <input type="radio" name="reason" className="mt-1 size-4 accent-brand-600" checked={reason === i} onChange={() => setReason(i)} />
              {r.text}
            </label>
          ))}
        </fieldset>
      </div>
      <Button className="self-end" disabled={!filled || idea == null || reason == null} onClick={submit}>
        ✓ ส่งคำตอบ
      </Button>
      {!filled && <p className="-mt-2 text-right text-xs text-slate-500">ให้คะแนนให้ครบทุกช่องก่อนนะ</p>}
    </div>
  )
}
