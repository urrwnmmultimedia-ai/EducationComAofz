import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { guidedProgress, normalizeRows, type SubmissionContent, type TableConfig } from './assignmentModel'

// ใบงานตารางแบบไกด์: ขั้นตอนทำ → เลือกเรื่อง → การ์ดทีละแถวเรียงเป็นเส้นเวลา (ป้ายแถว + ช่องมีตัวอย่างประโยค + คำให้แตะเติม)
// เก็บคำตอบรูปแบบเดิม (content.rows / content.text) ครูตรวจในตารางเหมือนเดิม

const ROW_TONE = [
  { chip: 'bg-sky-100 text-sky-900', orb: 'from-sky-300 via-sky-500 to-sky-700' },
  { chip: 'bg-brand-100 text-brand-900', orb: 'from-brand-300 via-action to-action-strong' },
  { chip: 'bg-gold-300/50 text-amber-900', orb: 'from-gold-300 via-gold-500 to-gold-600' },
  { chip: 'bg-emerald-100 text-emerald-900', orb: 'from-emerald-300 via-emerald-500 to-emerald-700' },
]

const FIELD =
  'w-full resize-y rounded-xl border-2 bg-white px-3 py-2 shadow-[inset_0_2px_4px_rgb(15_31_61/0.08)] outline-none placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-50'

export function GuidedWorksheet({
  config,
  content,
  locked,
  onChange,
}: {
  config: TableConfig
  content: SubmissionContent
  locked: boolean
  onChange: (patch: Partial<SubmissionContent>) => void
}) {
  const rows = normalizeRows(content.rows, config).slice(0, config.rows)
  const hasLabels = !!config.rowLabels?.length
  const firstEditable = hasLabels ? 1 : 0
  const { filled, total } = guidedProgress(config, content)
  const pct = total ? Math.round((filled / total) * 100) : 0
  const [showExample, setShowExample] = useState(false)

  const setCell = (r: number, c: number, v: string) =>
    onChange({ rows: normalizeRows(content.rows, config).map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)) })
  const addChip = (r: number, c: number, word: string) => {
    const cur = rows[r]?.[c] ?? ''
    if (cur.includes(word)) return
    setCell(r, c, cur.trim() ? `${cur.trim()}, ${word}` : word)
  }

  return (
    <div className="flex flex-col gap-5">
      {config.steps && config.steps.length > 0 && (
        <ol className="grid gap-2 sm:grid-cols-3">
          {config.steps.map((s, i) => (
            <li key={s} className="tq-raised flex items-start gap-3 p-3">
              <span className="tq-orb grid size-8 shrink-0 place-items-center rounded-full font-display text-sm" aria-hidden>
                {i + 1}
              </span>
              <span className="text-sm leading-snug text-ink">{s}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface shadow-[inset_0_1px_3px_rgb(20_45_100/0.18)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-action to-gold-400"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className={`text-sm font-display ${filled === total ? 'text-mint-500' : 'text-slate-600'}`}>
          กรอกแล้ว {filled}/{total} ช่อง{filled === total ? ' ✓ พร้อมส่ง' : ''}
        </span>
      </div>

      {config.example && (
        <div>
          <button
            type="button"
            aria-expanded={showExample}
            onClick={() => setShowExample(!showExample)}
            className="rounded-xl bg-white px-3 py-1.5 font-display text-sm text-brand-700 ring-1 ring-brand-300 hover:bg-brand-50"
          >
            {showExample ? 'ซ่อนตัวอย่าง' : '👀 ดูตัวอย่างที่ทำเสร็จแล้ว'}
          </button>
          <AnimatePresence>
            {showExample && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-2xl bg-sun-300/30 p-3 ring-1 ring-sun-400/60">
                  {config.example.topic && (
                    <p className="mb-2 font-display text-amber-900">ตัวอย่างเรื่อง: {config.example.topic} (ใบงานจริงให้เลือกเรื่องอื่น)</p>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr>
                          {config.columns.map((c) => (
                            <th key={c} className="px-2 py-1 font-display font-medium text-amber-900">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {config.example.rows.map((row, r) => (
                          <tr key={r} className="border-t border-amber-200/70">
                            {row.map((cell, c) => (
                              <td key={c} className="px-2 py-1.5 align-top text-slate-700">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {config.topic && (
        <section className="tq-raised p-4 sm:p-5">
          <label className="block">
            <span className="flex items-center gap-2 font-display text-lg text-brand-900">
              <span className="tq-orb grid size-8 place-items-center rounded-full text-sm" aria-hidden>
                ★
              </span>
              {config.topic.label}
            </span>
            <input
              className={`${FIELD} mt-2 text-lg ${content.text?.trim() ? 'border-mint-400' : 'border-brand-200'}`}
              disabled={locked}
              maxLength={120}
              value={content.text ?? ''}
              placeholder={config.topic.hint ?? ''}
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </label>
          {config.topic.choices && !locked && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="self-center text-sm text-slate-500">แตะเลือกได้:</span>
              {config.topic.choices.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={content.text === t}
                  onClick={() => onChange({ text: t })}
                  className="tq-chip px-3 py-1.5 text-sm"
                  data-state={content.text === t ? 'picked' : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <ol className="relative flex flex-col gap-0">
        {rows.map((row, r) => {
          const tone = ROW_TONE[r % ROW_TONE.length] ?? ROW_TONE[0]!
          const editable = row.map((_, c) => c).filter((c) => c >= firstEditable)
          const rowDone = editable.every((c) => row[c]?.trim())
          return (
            <li key={r} className="flex flex-col items-stretch">
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: r * 0.08 }}
                className="tq-raised p-4 sm:p-5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full bg-radial-[at_32%_28%] ${tone.orb} font-display text-white shadow-[inset_0_3px_6px_rgb(255_255_255/0.45),inset_0_-4px_8px_rgb(0_0_0/0.25),0_8px_16px_-6px_rgb(15_31_61/0.5)]`}
                    aria-hidden
                  >
                    {rowDone ? '✓' : r + 1}
                  </span>
                  <p className="font-display text-xl text-brand-900">{hasLabels ? row[0] : `แถวที่ ${r + 1}`}</p>
                  {rowDone && <span className="ml-auto rounded-full bg-mint-400/25 px-2.5 py-0.5 text-xs font-display text-emerald-800">ครบแล้ว</span>}
                </div>
                <div className={`grid gap-3 ${editable.length > 1 ? 'md:grid-cols-2' : ''}`}>
                  {editable.map((c) => {
                    const v = row[c] ?? ''
                    const chips = config.chips?.[c]
                    return (
                      <label key={c} className="flex flex-col gap-1.5">
                        <span className={`self-start rounded-lg px-2.5 py-1 text-sm font-display ${tone.chip}`}>{config.columns[c]}</span>
                        <textarea
                          rows={3}
                          disabled={locked}
                          aria-label={`${config.columns[c] ?? ''} ${hasLabels ? row[0] : `แถว ${r + 1}`}`}
                          className={`${FIELD} ${v.trim() ? 'border-mint-400' : 'border-brand-200'}`}
                          placeholder={config.hints?.[c] ?? ''}
                          value={v}
                          onChange={(e) => setCell(r, c, e.target.value)}
                        />
                        {chips && chips.length > 0 && !locked && (
                          <span className="flex flex-wrap gap-1">
                            {chips.map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => addChip(r, c, w)}
                                className={`rounded-full px-2 py-0.5 text-xs ring-1 transition ${
                                  v.includes(w) ? 'bg-action text-white ring-action' : 'bg-white text-brand-700 ring-brand-200 hover:bg-brand-50'
                                }`}
                              >
                                {v.includes(w) ? '✓ ' : '+ '}
                                {w}
                              </button>
                            ))}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </motion.section>
              {r < rows.length - 1 && (
                <span aria-hidden className="flex justify-center py-1 text-action">
                  <span className="tq-flow-line-v block h-7 w-1.5 rounded-full" />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
