import { useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import type { AppSettingsRow, AssignmentRow, StudentRow, SubmissionRow } from '@/lib/database.types'
import { formatGrade } from '@/lib/grade'
import { CATEGORY_LABELS } from '@/lib/scoring'
import { useAsync } from '@/lib/useAsync'
import {
  buildExportSheets,
  buildGradebook,
  fetchSettings,
  fullName,
  policyFromSettings,
  sortAssignments,
} from '@/features/assignments/gradebookData'
import { fetchGradebookSource, setScore, type GradebookSource } from './adminAssignmentsApi'
import { downloadWorkbook } from './exportExcel'

export function AdminGradebookPage() {
  const state = useAsync(async () => {
    const [source, settings] = await Promise.all([fetchGradebookSource(), fetchSettings()])
    return { source, settings }
  }, [])
  if (state.status === 'loading') return <LoadingBlock label="กำลังโหลดสมุดคะแนน…" />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  return <Gradebook source={state.data.source} settings={state.data.settings} />
}

type CellState = 'saving' | 'saved' | 'error'

function Gradebook({ source, settings }: { source: GradebookSource; settings: AppSettingsRow }) {
  const [roomId, setRoomId] = useState(source.classrooms[0]?.id ?? '')
  const [subs, setSubs] = useState<SubmissionRow[]>(source.submissions)
  const [cells, setCells] = useState<Record<string, CellState>>({})
  const [exporting, setExporting] = useState(false)

  const policy = policyFromSettings(settings)
  const assignments = useMemo(() => sortAssignments(source.assignments), [source.assignments])
  const students = source.students.filter((s) => s.classroom_id === roomId)
  const xpByStudent = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of source.xp) m.set(e.student_id, (m.get(e.student_id) ?? 0) + e.xp)
    return m
  }, [source.xp])
  const rows = buildGradebook(students, assignments, subs, policy, xpByStudent)
  const subMap = new Map(subs.map((s) => [`${s.student_id}:${s.assignment_id}`, s]))
  const room = source.classrooms.find((c) => c.id === roomId)

  const saveCell = async (student: StudentRow, a: AssignmentRow, text: string) => {
    const key = `${student.id}:${a.id}`
    const current = subMap.get(key)
    const currentScore = current?.status === 'graded' && current.score != null ? Number(current.score) : null
    const next = text.trim() === '' ? null : Number(text)
    if (next === currentScore) return
    if (next != null && (!Number.isFinite(next) || next < 0 || next > Number(a.max_score))) {
      setCells((c) => ({ ...c, [key]: 'error' }))
      return
    }
    setCells((c) => ({ ...c, [key]: 'saving' }))
    try {
      await setScore(a.id, student.id, next)
      setSubs((list) => {
        const exists = list.some((s) => s.student_id === student.id && s.assignment_id === a.id)
        const patch: Partial<SubmissionRow> =
          next == null ? { score: null, status: current?.submitted_at ? 'submitted' : 'draft' } : { score: next, status: 'graded' }
        if (exists) return list.map((s) => (s.student_id === student.id && s.assignment_id === a.id ? { ...s, ...patch } : s))
        return [
          ...list,
          { id: key, assignment_id: a.id, student_id: student.id, content: {}, file_paths: [], submitted_at: null, score: next, feedback: null, status: 'graded', updated_at: '' },
        ]
      })
      setCells((c) => ({ ...c, [key]: 'saved' }))
    } catch {
      setCells((c) => ({ ...c, [key]: 'error' }))
    }
  }

  const exportXlsx = async () => {
    if (!room || exporting) return
    setExporting(true)
    try {
      const { pp5, detail } = buildExportSheets(rows, assignments, subs, {
        classroom: room.name,
        term: settings.term,
        year: settings.year,
        school: settings.school_name,
      })
      await downloadWorkbook(`คะแนน-เทคโนโลยี-${room.name.replace('/', '-')}-${settings.term}-${settings.year}.xlsx`, [
        { name: 'ปพ.5', rows: pp5, colWidths: [7, 12, 30, 18, 18, 10, 10] },
        { name: 'รายละเอียดคะแนน', rows: detail, colWidths: [7, 12, 30] },
      ])
    } finally {
      setExporting(false)
    }
  }

  const savingAny = Object.values(cells).includes('saving')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">สมุดคะแนน</h1>
          <p className="text-sm text-slate-500">พิมพ์คะแนนในช่องแล้วกด Tab / คลิกออก เพื่อบันทึก · ช่องว่าง = ยังไม่มีคะแนน</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500" role="status">
            {savingAny ? 'กำลังบันทึก…' : Object.values(cells).includes('saved') ? 'บันทึกแล้ว ✓' : ''}
          </span>
          <select className="rounded-xl border-2 border-brand-100 bg-white px-3 py-2" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="ห้องเรียน">
            {source.classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" loading={exporting} loadingText="กำลังสร้างไฟล์…" disabled={!room || students.length === 0} onClick={() => void exportXlsx()}>
            ⬇ ส่งออก Excel (ปพ.5)
          </Button>
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyBlock>ห้องนี้ยังไม่มีนักเรียน</EmptyBlock>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-3xl bg-white shadow-sm ring-1 ring-brand-100">
          <table className="border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-brand-50">
              <tr>
                <th className="sticky left-0 z-30 min-w-52 bg-brand-50 px-3 py-2 text-left font-medium">นักเรียน</th>
                {assignments.map((a) => (
                  <th key={a.id} className="min-w-20 max-w-28 px-2 py-2 text-center align-bottom text-xs font-medium" title={a.title}>
                    <span className="block text-[10px] text-brand-500">{CATEGORY_LABELS[a.category]}</span>
                    <span className="line-clamp-2">{a.title}</span>
                    <span className="text-slate-400">/{Number(a.max_score)}</span>
                  </th>
                ))}
                {rows[0]?.score.categories.map((c) => (
                  <th key={c.category} className="min-w-20 bg-brand-100 px-2 py-2 text-center text-xs font-medium">
                    {CATEGORY_LABELS[c.category]}
                    <span className="block text-slate-500">/{c.weight}</span>
                  </th>
                ))}
                <th className="min-w-16 bg-brand-100 px-2 py-2 text-center font-medium">รวม</th>
                <th className="min-w-14 bg-brand-100 px-2 py-2 text-center font-medium">เกรด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student, score }) => (
                <tr key={student.id}>
                  <td className="sticky left-0 z-10 border-t border-brand-50 bg-white px-3 py-1.5">
                    <span className="text-slate-400">{student.number ?? '-'}.</span> {fullName(student)}
                  </td>
                  {assignments.map((a) => {
                    const key = `${student.id}:${a.id}`
                    const s = subMap.get(key)
                    const value = s?.status === 'graded' && s.score != null ? String(Number(s.score)) : ''
                    const st = cells[key]
                    return (
                      <td key={a.id} className="border-t border-brand-50 px-1 py-1 text-center">
                        <input
                          key={value}
                          defaultValue={value}
                          inputMode="decimal"
                          aria-label={`${fullName(student)} ${a.title}`}
                          placeholder={s?.status === 'submitted' ? 'รอ' : ''}
                          className={`w-16 rounded-lg border-2 px-1 py-1 text-center outline-none ${
                            st === 'error' ? 'border-rose-400 bg-rose-50' : st === 'saving' ? 'border-sky-300' : 'border-transparent hover:border-brand-100 focus:border-brand-500'
                          } ${s?.status === 'submitted' ? 'bg-sky-50 placeholder:text-sky-600' : ''}`}
                          onBlur={(e) => void saveCell(student, a, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur()
                          }}
                        />
                      </td>
                    )
                  })}
                  {score.categories.map((c) => (
                    <td key={c.category} className="border-t border-brand-50 bg-brand-50/50 px-2 py-1.5 text-center">
                      {c.scaled}
                    </td>
                  ))}
                  <td className="border-t border-brand-50 bg-brand-50/50 px-2 py-1.5 text-center font-display text-brand-800">{score.total}</td>
                  <td className="border-t border-brand-50 bg-brand-50/50 px-2 py-1.5 text-center font-display text-brand-800">{formatGrade(score.grade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        ช่องสีฟ้า = นักเรียนส่งแล้วรอตรวจ · ส่งช้าจะถูกหัก {policy.latePenaltyEnabled ? `${policy.latePenaltyPct}%` : '0% (ปิดอยู่)'} อัตโนมัติในคะแนนรวม
      </p>
    </div>
  )
}
