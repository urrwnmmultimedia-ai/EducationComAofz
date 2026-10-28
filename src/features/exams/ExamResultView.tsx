import { Link } from 'react-router'
import { Doctor } from '@/components/characters/Characters'
import { matchingChoicesSchema, parseAnswer, type ExamResult, type ReviewItem } from './examModel'

export function ExamResultView({ result, backTo }: { result: ExamResult; backTo: string }) {
  const score = result.score ?? 0
  const max = result.max_points ?? 0
  const pct = max ? Math.round((score / max) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-brand-100">
        <Doctor className="size-20" />
        <p className="text-slate-500">ส่งข้อสอบแล้ว</p>
        <p className="font-display text-5xl text-brand-700">
          {score} <span className="text-2xl text-slate-400">/ {max}</span>
        </p>
        <p className="text-slate-600">{pct >= 80 ? 'เยี่ยมมาก! 🎉' : pct >= 50 ? 'ทำได้ดี ทบทวนข้อที่ผิดอีกนิดนะ' : 'ไม่เป็นไร ลองทบทวนบทเรียนอีกครั้ง 💪'}</p>
        {result.needs_review && <p className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">มีข้อเขียนรอครูตรวจ คะแนนอาจเพิ่มขึ้น</p>}
        <Link to={backTo} className="mt-2 font-display text-brand-700 underline underline-offset-4">
          กลับ
        </Link>
      </section>

      {result.show_answers && result.review ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg text-brand-900">เฉลยและคำอธิบาย</h2>
          {result.review.map((item, i) => (
            <ReviewCard key={item.id} no={i + 1} item={item} />
          ))}
        </section>
      ) : (
        <p className="text-center text-sm text-slate-500">ครูยังไม่เปิดให้ดูเฉลยของชุดนี้</p>
      )}
    </div>
  )
}

function ReviewCard({ no, item }: { no: number; item: ReviewItem }) {
  const pts = item.points
  const status = pts == null ? 'รอครูตรวจ' : pts >= 1 ? 'ถูก' : pts > 0 ? `ถูกบางส่วน (${pts})` : 'ผิด'
  const cls = pts == null ? 'bg-amber-50 ring-amber-200' : pts >= 1 ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'
  return (
    <article className={`rounded-2xl p-4 ring-1 ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-slate-800">
          {no}. {item.prompt}
        </p>
        <span className="shrink-0 text-sm font-display">{status}</span>
      </div>
      <dl className="mt-2 grid gap-1 text-sm">
        <div>
          <dt className="inline text-slate-500">คำตอบของฉัน: </dt>
          <dd className="inline">{describeAnswer(item, item.answer)}</dd>
        </div>
        {item.type !== 'short' && (
          <div>
            <dt className="inline text-slate-500">เฉลย: </dt>
            <dd className="inline font-medium text-emerald-800">{describeAnswer(item, item.correct)}</dd>
          </div>
        )}
        {item.explanation && <p className="mt-1 text-slate-600">💡 {item.explanation}</p>}
      </dl>
    </article>
  )
}

// แปลงคำตอบ/เฉลยเป็นข้อความอ่านง่าย
export function describeAnswer(item: { type: string; choices: unknown }, raw: unknown): string {
  if (raw == null) return '—'
  const list: unknown[] = Array.isArray(item.choices) ? item.choices : []
  if (item.type === 'fill' && typeof raw === 'object' && raw !== null && 'accept' in raw) {
    return (raw as { accept: string[] }).accept.join(' / ')
  }
  const a = parseAnswer(raw)
  if (!a) return '—'
  if ('index' in a) return String(list[a.index] ?? '—')
  if ('value' in a) return a.value ? 'ถูก' : 'ผิด'
  if ('text' in a) return a.text || '—'
  if ('order' in a) return a.order.map((i) => list[i]).join(' → ')
  if ('pairs' in a) {
    const m = matchingChoicesSchema.safeParse(item.choices)
    if (!m.success) return '—'
    return m.data.left.map((l, i) => `${l} = ${a.pairs[i] != null ? m.data.right[a.pairs[i] as number] : '?'}`).join(' · ')
  }
  return '—'
}
