import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { CATEGORIES, CATEGORY_LABELS, parseWeights } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import { fetchSettings } from '@/features/assignments/gradebookData'
import { fetchAssignmentsAdmin } from './adminAssignmentsApi'

const TYPE_LABEL = { text: 'ข้อความ', table: 'ตาราง', file: 'อัปโหลดไฟล์', link: 'ลิงก์', score_only: 'กรอกคะแนน/สอบ' } as const

export function AdminAssignmentsPage() {
  const state = useAsync(async () => {
    const [data, settings] = await Promise.all([fetchAssignmentsAdmin(), fetchSettings()])
    return { ...data, weights: parseWeights(settings.score_weights) }
  }, [])

  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { assignments, sessions, weights, pending } = state.data
  const sessionTitle = new Map(sessions.map((s) => [s.session_no, s.title]))
  const waiting = assignments.filter((a) => (pending.get(a.id) ?? 0) > 0)
  const totalWaiting = waiting.reduce((n, a) => n + (pending.get(a.id) ?? 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">งาน / รายการคะแนน</h1>
          <p className="text-sm text-slate-500">สร้างงาน ตั้งคะแนนเต็ม กำหนดส่ง และตรวจงาน</p>
        </div>
        <Link to="/admin/assignments/new" className="rounded-2xl bg-brand-600 px-5 py-2.5 font-display text-white">
          + สร้างงาน
        </Link>
      </div>

      {/* กล่องงานรอตรวจ: กดแล้วเข้าหน้าตรวจของงานนั้นเลย */}
      <section className="rounded-3xl bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm ring-1 ring-sky-200 sm:p-5">
        <h2 className="text-lg text-brand-900">
          งานรอตรวจ {totalWaiting > 0 ? <span className="ml-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-sm text-white">{totalWaiting}</span> : null}
        </h2>
        {waiting.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">ไม่มีงานรอตรวจ 🎉</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {waiting.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/admin/assignments/${a.id}/grade`}
                  className="tq-press inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-sky-200 hover:bg-sky-50"
                >
                  {a.session_no && <span className="font-display text-brand-700">คาบ {a.session_no}</span>}
                  <span className="max-w-56 truncate">{a.title}</span>
                  <span className="rounded-full bg-sky-600 px-2 font-display text-white">{pending.get(a.id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CATEGORIES.map((c) => {
          const sum = assignments.filter((a) => a.category === c).reduce((s, a) => s + Number(a.max_score), 0)
          return (
            <div key={c} className="rounded-2xl bg-white p-3 text-sm ring-1 ring-brand-100">
              <p className="text-slate-500">{CATEGORY_LABELS[c]}</p>
              <p className="font-display text-lg text-brand-700">
                เต็ม {sum} → {weights[c]}
              </p>
            </div>
          )
        })}
      </section>
      <p className="-mt-2 text-xs text-slate-500">ระบบแปลงผลรวมคะแนนเต็มของแต่ละประเภทเป็นสัดส่วนในตั้งค่าอัตโนมัติ เพิ่ม/ลดงานได้ไม่ต้องคิดเลขเอง</p>

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-brand-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">คาบ</th>
              <th className="px-3 py-2 font-medium">ชื่องาน</th>
              <th className="px-3 py-2 font-medium">ประเภท</th>
              <th className="px-3 py-2 font-medium">หมวด</th>
              <th className="px-3 py-2 font-medium">เต็ม</th>
              <th className="px-3 py-2 font-medium">กำหนดส่ง</th>
              <th className="px-3 py-2 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-t border-brand-50">
                <td className="px-3 py-2 font-display text-brand-700" title={a.session_no ? sessionTitle.get(a.session_no) : ''}>
                  {a.session_no ?? '–'}
                </td>
                <td className="px-3 py-2">{a.title}</td>
                <td className="px-3 py-2">{TYPE_LABEL[a.type]}</td>
                <td className="px-3 py-2">{CATEGORY_LABELS[a.category]}</td>
                <td className="px-3 py-2">{Number(a.max_score)}</td>
                <td className="px-3 py-2 text-slate-500">
                  {a.due_at ? new Date(a.due_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '–'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Link to={`/admin/assignments/${a.id}/grade`} className="rounded-lg px-2 py-1 font-display text-brand-700 hover:bg-brand-100">
                      ตรวจ
                      {(pending.get(a.id) ?? 0) > 0 && <span className="ml-1 rounded-full bg-sky-600 px-1.5 text-xs text-white">{pending.get(a.id)}</span>}
                    </Link>
                    <Link to={`/admin/assignments/${a.id}`} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-brand-100">
                      แก้ไข
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
