import type { Block, TableData } from '@/content/lesson'
import { Globe2, Lightbulb, TriangleAlert } from 'lucide-react'
import { DbqMarkdown } from './DbqMarkdown'
import { FIGURES } from './figures'

// แสดงบล็อกเนื้อหาในการ์ดบทเรียน (ข้อความ ภาพ ตาราง โค้ด SQL ชีวิตจริง ทิป คำเตือน ก่อน/หลัง ขั้นตอน)

const CALLOUT = 'rounded-2xl p-4 ring-1'

function DataTable({ t }: { t: TableData }) {
  const hlRows = new Set(t.highlight?.rows ?? [])
  const hlCols = new Set(t.highlight?.cols ?? [])
  const hl = t.highlight?.tone === 'bad' ? 'bg-rose-100 dark:bg-rose-950' : 'bg-emerald-100 dark:bg-emerald-950'
  return (
    <div className="overflow-x-auto rounded-2xl ring-1 ring-dq-100 dark:ring-dq-800">
      {t.title && <p className="bg-dq-50 px-3 py-2 font-display text-base dark:bg-dq-900">{t.title}</p>}
      <table className="w-full border-collapse text-left text-base">
        <thead className="bg-dq-100 text-dq-900 dark:bg-dq-800 dark:text-white">
          <tr>
            {t.columns.map((c) => (
              <th key={c.name} className="px-3 py-2 font-display font-medium whitespace-nowrap">
                {c.name}
                {c.role && (
                  <span className="ml-1 rounded bg-xp-300 px-1 text-xs text-ink uppercase">{c.role}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row, r) => (
            <tr key={r} className={hlRows.has(r) ? hl : ''}>
              {row.map((cell, c) => (
                <td key={c} className={`border-t border-dq-100 px-3 py-2 align-top dark:border-dq-800 ${hlCols.has(c) ? hl : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Caption({ text }: { text: string }) {
  return <figcaption className="mt-2 text-center text-base text-slate-500 dark:text-dq-300">{text}</figcaption>
}

export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text':
      return <DbqMarkdown text={block.md} />
    case 'figure': {
      const Fig = FIGURES[block.name]
      return (
        <figure className="flex flex-col items-center rounded-2xl bg-white p-4 ring-1 ring-dq-100 dark:bg-dq-950 dark:ring-dq-800">
          {Fig ? (
            <div role="img" aria-label={block.alt} className="flex w-full justify-center">
              <Fig />
            </div>
          ) : (
            <p className="text-slate-500">{block.alt}</p>
          )}
          <Caption text={block.caption} />
        </figure>
      )
    }
    case 'table':
      return (
        <figure>
          <DataTable t={block} />
          <Caption text={block.caption} />
        </figure>
      )
    case 'code':
      return (
        <figure className="space-y-2">
          <pre className="overflow-x-auto rounded-2xl bg-dq-950 p-4 font-mono text-base text-dq-50 ring-1 ring-dq-800">
            <code>{block.sql}</code>
          </pre>
          {block.result && <DataTable t={{ columns: block.result.columns.map((name) => ({ name })), rows: block.result.rows }} />}
          {block.caption && <Caption text={block.caption} />}
        </figure>
      )
    case 'reallife':
      return (
        <aside className={`${CALLOUT} bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900`}>
          <p className="font-display text-amber-900 dark:text-amber-200">
            <Globe2 className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden /> 
            {block.title}
          </p>
          <DbqMarkdown text={block.md} />
        </aside>
      )
    case 'tip':
      return (
        <aside className={`${CALLOUT} bg-sky-50 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-900`}>
          <p className="flex items-center gap-1.5 font-display text-sky-900 dark:text-sky-200"><Lightbulb className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden /> ทิป</p>
          <DbqMarkdown text={block.md} />
        </aside>
      )
    case 'warning':
      return (
        <aside className={`${CALLOUT} bg-rose-50 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-900`}>
          <p className="flex items-center gap-1.5 font-display text-rose-900 dark:text-rose-200"><TriangleAlert className="inline size-5 shrink-0 align-[-0.2em]" aria-hidden /> ระวัง</p>
          <DbqMarkdown text={block.md} />
        </aside>
      )
    case 'beforeAfter':
      return (
        <figure className="space-y-3">
          <p className="font-display text-rose-700 dark:text-rose-300">ก่อน</p>
          <DataTable t={block.before} />
          <p className="font-display text-emerald-700 dark:text-emerald-300">หลัง</p>
          <div className="grid gap-3 md:grid-cols-2">
            {block.after.map((t, i) => (
              <DataTable key={i} t={t} />
            ))}
          </div>
          <Caption text={block.caption} />
        </figure>
      )
    case 'steps':
      return (
        <section>
          <p className="mb-3 font-display text-dq-900 dark:text-white">{block.title}</p>
          <ol className="space-y-3">
            {block.steps.map((s, i) => {
              const Fig = s.figure ? FIGURES[s.figure] : undefined
              return (
                <li key={i} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-dq-600 font-display text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="font-display">{s.title}</p>
                    <DbqMarkdown text={s.md} />
                    {Fig && <Fig />}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )
  }
}
