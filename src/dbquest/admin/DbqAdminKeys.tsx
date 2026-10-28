import { useState } from 'react'
import { BookOpen, Lightbulb, NotebookPen, TriangleAlert } from 'lucide-react'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { course } from '@/content/course'
import { hasSessionContent, loadSessionContent, type Question, type SessionContent } from '@/content/lesson'
import { useAsync } from '@/lib/useAsync'
import { input, PageHeader, panel } from './adminUi'
import { fetchAnswerKeys, type AnswerKeyItem } from './dbqAdminApi'

const LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ']
const TYPE_LABEL: Record<string, string> = { check: 'เช็กความเข้าใจ', practice: 'ฝึกปฏิบัติ', wrapup: 'ภารกิจปิดคาบ', worksheet: 'ใบงาน', game: 'เกม', quiz: 'ข้อสอบ', project: 'โครงงาน' }

// เฉลยทั้งหมดของคาบ (ดึงจากเซิร์ฟเวอร์ เฉพาะครู) จับคู่กับโจทย์ในไฟล์เนื้อหาเพื่ออ่านง่าย
export function DbqAdminKeys() {
  const lessons = course.sessions.filter((s) => hasSessionContent(s.no))
  const [no, setNo] = useState(lessons[0]?.no ?? 1)
  const res = useAsync(async () => {
    const [keys, content] = await Promise.all([fetchAnswerKeys(no), loadSessionContent(no)])
    return { keys, content }
  }, [no])

  return (
    <div className="space-y-4">
      <PageHeader title="เฉลยทั้งหมด">
        <select className={input} aria-label="เลือกคาบ" value={no} onChange={(e) => setNo(Number(e.target.value))}>
          {lessons.map((s) => (
            <option key={s.no} value={s.no}>
              คาบ {s.no}: {s.title}
            </option>
          ))}
        </select>
      </PageHeader>
      <p className="flex items-center gap-1.5 text-sm text-slate-600"><TriangleAlert className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> หน้านี้เปิดได้เฉพาะครู ระวังเปิดจอขณะฉายโปรเจกเตอร์</p>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' &&
        (res.data.keys.length === 0 ? (
          <p className={`${panel} text-slate-500`}>ยังไม่มีเฉลยของคาบนี้ในฐานข้อมูล (รัน supabase/updates/dbquest_content.sql)</p>
        ) : (
          <ul className="space-y-3">
            {res.data.keys.map((k) => (
              <li key={k.item_id}>
                <KeyCard item={k} question={findQuestion(res.data.content, k.item_id)} />
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

function findQuestion(c: SessionContent | null, id: string): Question | undefined {
  if (!c) return undefined
  return [...c.cards.map((x) => x.check), ...c.practice, ...(c.closing?.questions ?? [])].find((q) => q.id === id)
}

// แปลงเฉลย (รูปแบบเดียวกับที่เซิร์ฟเวอร์ตรวจ) เป็นข้อความที่ครูอ่านได้
export function describeAnswer(q: Question | undefined, answer: Record<string, unknown>): string[] {
  if (!q) return [JSON.stringify(answer)]
  const text = (list: { id: string; text: string }[], id: unknown) => list.find((x) => x.id === id)?.text ?? String(id)
  switch (q.type) {
    case 'mcq': {
      const i = Number(answer.choice)
      return [`${LETTERS[i] ?? i}. ${q.choices[i] ?? ''}`]
    }
    case 'multi':
      return (answer.choices as number[]).map((i) => `${LETTERS[i] ?? i}. ${q.choices[i] ?? ''}`)
    case 'fill':
      return [`รับคำตอบ: ${(answer.accept as string[]).join(' / ')}`]
    case 'order':
      return (answer.order as string[]).map((id, i) => `${i + 1}. ${text(q.items, id)}`)
    case 'match':
      return Object.entries(answer.pairs as Record<string, string>).map(([l, r]) => `${text(q.left, l)} → ${text(q.right, r)}`)
    case 'classify':
      return Object.entries(answer.pairs as Record<string, string>).map(([i, c]) => `${text(q.items, i)} → ${text(q.categories, c)}`)
  }
}

function KeyCard({ item, question }: { item: AnswerKeyItem; question?: Question }) {
  const sample = typeof item.answer.sample === 'string' ? item.answer.sample : null
  return (
    <article className={`${panel} space-y-2`}>
      <p className="text-xs text-slate-500">
        {TYPE_LABEL[item.item_type] ?? item.item_type} · <span className="font-mono">{item.item_id}</span>
      </p>
      {question && <p className="font-display text-dq-900">{question.prompt.replaceAll('**', '')}</p>}
      {item.grade_type === 'rubric' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ul className="space-y-1 text-sm">
            {item.rubric?.map((r, i) => (
              <li key={i}>
                • {r.criterion} <span className="font-display">({r.points})</span>
              </li>
            ))}
          </ul>
          {sample && <p className="whitespace-pre-wrap rounded-xl bg-emerald-50 p-3 text-sm">{sample}</p>}
        </div>
      ) : (
        <ul className="rounded-xl bg-emerald-50 p-3 font-display text-emerald-900">
          {describeAnswer(question, item.answer).map((line, i) => (
            <li key={i}>✓ {line}</li>
          ))}
        </ul>
      )}
      {item.explanation && <p className="flex gap-1.5 text-sm"><BookOpen className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> {item.explanation}</p>}
      {item.hint && <p className="flex gap-1.5 text-sm text-slate-600"><Lightbulb className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> คำใบ้ที่นักเรียนเห็น: {item.hint}</p>}
      {item.teacher_notes && <p className="flex gap-1.5 text-sm text-amber-800"><NotebookPen className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> {item.teacher_notes}</p>}
    </article>
  )
}
