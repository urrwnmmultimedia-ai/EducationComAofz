import { useState } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { supabase } from '@/lib/supabase'
import { useAsync } from '@/lib/useAsync'
import { buildGradebook, fetchSettings, policyFromSettings } from '@/features/assignments/gradebookData'
import { fetchGradebookSource } from './adminAssignmentsApi'
import { averageByClassroom, mostMissed, type ClassroomAverage } from './dashboardData'

const ONLINE_WINDOW_MIN = 10
const BAR = '#7c3aed' // brand-600 (ผ่านการตรวจ contrast กับพื้นหลัง)

async function fetchDashboard() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MIN * 60_000).toISOString()
  const [source, settings, online, attempts, questions] = await Promise.all([
    fetchGradebookSource(),
    fetchSettings(),
    supabase.from('sessions').select('auth_uid', { count: 'exact', head: true }).eq('role', 'student').gte('last_seen_at', since),
    supabase.from('exam_attempts').select('*').not('submitted_at', 'is', null),
    supabase.from('questions').select('*'),
  ])
  if (online.error) throw online.error
  if (attempts.error) throw attempts.error
  if (questions.error) throw questions.error
  return { source, settings, online: online.count ?? 0, attempts: attempts.data, questions: questions.data }
}

export function AdminDashboardPage() {
  const state = useAsync(fetchDashboard, [])
  if (state.status === 'loading') return <LoadingBlock label="กำลังโหลดแดชบอร์ด…" />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { source, settings, online, attempts, questions } = state.data

  const xp = new Map<string, number>()
  for (const e of source.xp) xp.set(e.student_id, (xp.get(e.student_id) ?? 0) + e.xp)
  const rows = buildGradebook(source.students, source.assignments, source.submissions, policyFromSettings(settings), xp)
  const averages = averageByClassroom(rows, new Map(source.classrooms.map((c) => [c.id, c.name])))
  const pendingWork = source.submissions.filter((s) => s.status === 'submitted').length
  const pendingShort = attempts.filter((a) => a.needs_review).length
  const missed = mostMissed(attempts, questions)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl text-brand-900">แดชบอร์ดครู</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="นักเรียน (ใช้งานอยู่)" value={source.students.length} />
        <Stat label={`ออนไลน์ (${ONLINE_WINDOW_MIN} นาทีล่าสุด)`} value={online} />
        <Stat label="งานรอตรวจ" value={pendingWork} to="/admin/assignments" highlight={pendingWork > 0} />
        <Stat label="ข้อเขียนในข้อสอบรอตรวจ" value={pendingShort} to="/admin/exams" highlight={pendingShort > 0} />
      </div>

      <AverageChart data={averages} />

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
        <h2 className="text-lg text-brand-900">ข้อสอบที่นักเรียนตอบผิดมากที่สุด</h2>
        <p className="mb-3 text-xs text-slate-500">จากทุกชุดสอบ (นับเฉพาะข้อที่มีคนตอบอย่างน้อย 3 คน) — ควรทบทวนเนื้อหาหรือตรวจคำถาม/เฉลย</p>
        {missed.length === 0 ? (
          <EmptyBlock>ยังมีข้อมูลการสอบไม่พอ</EmptyBlock>
        ) : (
          <ol className="flex flex-col gap-2">
            {missed.map((m, i) => (
              <li key={m.question.id} className="flex items-start gap-3 rounded-2xl bg-brand-50 p-3 text-sm">
                <span className="font-display text-brand-700">{i + 1}.</span>
                <span className="min-w-0 flex-1">{m.question.prompt}</span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-slate-800">ถูก {Math.round(m.correctRate * 100)}%</span>
                  <span className="text-xs text-slate-500">ตอบ {m.answered} ครั้ง</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['/admin/sessions', '📅 เปิด/ปิดคาบเรียน'],
          ['/admin/gradebook', '📊 สมุดคะแนน + ส่งออก ปพ.5'],
          ['/admin/students', '👥 รายชื่อนักเรียน / นำเข้า'],
        ].map(([to, label]) => (
          <Link key={to} to={to as string} className="rounded-2xl bg-white p-4 font-display text-brand-800 shadow-sm ring-1 ring-brand-100 hover:bg-brand-50">
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, to, highlight }: { label: string; value: number; to?: string; highlight?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`font-display text-3xl ${highlight ? 'text-amber-700' : 'text-brand-700'}`}>{value}</p>
    </>
  )
  const cls = `rounded-2xl bg-white p-4 shadow-sm ring-1 ${highlight ? 'ring-amber-300' : 'ring-brand-100'}`
  return to ? (
    <Link to={to} className={`${cls} hover:bg-brand-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

// คะแนนรวมเฉลี่ยรายห้อง: ชุดข้อมูลเดียว สีเดียว ไม่ต้องมีคำอธิบายสัญลักษณ์ (หัวข้อบอกแล้ว) + มุมมองตาราง
function AverageChart({ data }: { data: ClassroomAverage[] }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg text-brand-900">คะแนนรวมเฉลี่ยรายห้อง (จาก 100)</h2>
          <p className="text-xs text-slate-500">คิดจากทุกรายการคะแนนทั้งเทอม (รายการที่ยังไม่มีคะแนนนับเป็น 0)</p>
        </div>
        <button type="button" onClick={() => setAsTable(!asTable)} className="rounded-xl px-3 py-1 text-sm text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50">
          {asTable ? 'ดูเป็นกราฟ' : 'ดูเป็นตาราง'}
        </button>
      </div>
      {data.length === 0 ? (
        <EmptyBlock>ยังไม่มีนักเรียนในห้องเรียน</EmptyBlock>
      ) : asTable ? (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-medium">ห้อง</th>
              <th className="py-1 font-medium">นักเรียน</th>
              <th className="py-1 font-medium">คะแนนเฉลี่ย</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.classroom} className="border-t border-brand-50">
                <td className="py-1.5">{d.classroom}</td>
                <td className="py-1.5">{d.students}</td>
                <td className="py-1.5 font-display">{d.average}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-64" role="img" aria-label={`กราฟคะแนนเฉลี่ย: ${data.map((d) => `${d.classroom} ${d.average}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#ede9fe" />
              <XAxis dataKey="classroom" tickLine={false} axisLine={{ stroke: '#ddd6fe' }} tick={{ fill: '#475569', fontSize: 13 }} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: '#f5f3ff' }}
                content={({ active, payload }) => {
                  const d = active ? (payload?.[0]?.payload as ClassroomAverage | undefined) : undefined
                  return d ? (
                    <div className="rounded-xl bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-brand-100">
                      <p className="font-display text-slate-800">{d.classroom}</p>
                      <p className="text-slate-600">
                        เฉลี่ย {d.average} คะแนน · {d.students} คน
                      </p>
                    </div>
                  ) : null
                }}
              />
              <Bar dataKey="average" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="average" position="top" fill="#334155" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
