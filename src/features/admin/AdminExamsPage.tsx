import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { EXAM_KIND_LABELS } from '@/features/exams/examsApi'

async function fetchData() {
  const [e, a, q] = await Promise.all([
    supabase.from('exams').select('*').order('session_no').order('created_at'),
    supabase.from('exam_attempts').select('exam_id, submitted_at, needs_review'),
    supabase.from('questions').select('id, reviewed'),
  ])
  if (e.error) throw e.error
  if (a.error) throw a.error
  if (q.error) throw q.error
  return { exams: e.data, attempts: a.data, questions: q.data }
}

export function AdminExamsPage() {
  const state = useAsync(fetchData, [])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { exams, attempts, questions } = state.data
  const unreviewed = new Set(questions.filter((q) => !q.reviewed).map((q) => q.id))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">ชุดสอบ</h1>
          <p className="text-sm text-slate-500">Exit ticket, ทดสอบท้ายหน่วย, กลาง/ปลายภาค, ก่อน/หลังเรียน</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/questions" className="rounded-2xl px-4 py-2.5 font-display text-brand-700 ring-2 ring-brand-200 hover:bg-brand-100">
            คลังข้อสอบ
          </Link>
          <Link to="/admin/exams/new" className="rounded-2xl bg-brand-600 px-5 py-2.5 font-display text-white">
            + สร้างชุดสอบ
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-brand-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">คาบ</th>
              <th className="px-3 py-2 font-medium">ชุดสอบ</th>
              <th className="px-3 py-2 font-medium">ประเภท</th>
              <th className="px-3 py-2 font-medium">ข้อ</th>
              <th className="px-3 py-2 font-medium">ส่งแล้ว</th>
              <th className="px-3 py-2 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((e) => {
              const mine = attempts.filter((a) => a.exam_id === e.id && a.submitted_at)
              const review = mine.filter((a) => a.needs_review).length
              const draft = e.question_ids.filter((id) => unreviewed.has(id)).length
              return (
                <tr key={e.id} className="border-t border-brand-50">
                  <td className="px-3 py-2 font-display text-brand-700">{e.session_no ?? '–'}</td>
                  <td className="px-3 py-2">
                    {e.title}
                    {draft > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs text-amber-800">ข้อยังไม่ตรวจ {draft}</span>}
                  </td>
                  <td className="px-3 py-2">{EXAM_KIND_LABELS[e.kind]}</td>
                  <td className="px-3 py-2">{e.question_ids.length}</td>
                  <td className="px-3 py-2">
                    {mine.length}
                    {review > 0 && <span className="ml-2 rounded-full bg-sky-100 px-2 text-xs text-sky-800">รอตรวจข้อเขียน {review}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Link to={`/admin/exams/${e.id}/results`} className="rounded-lg px-2 py-1 font-display text-brand-700 hover:bg-brand-100">
                        ผลสอบ
                      </Link>
                      <Link to={`/admin/exams/${e.id}`} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-brand-100">
                        ตั้งค่า
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
