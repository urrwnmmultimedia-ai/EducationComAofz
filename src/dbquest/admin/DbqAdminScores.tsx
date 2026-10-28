import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { downloadWorkbook } from '@/features/admin/exportExcel'
import { useAsync } from '@/lib/useAsync'
import { btn, displayName, input, PageHeader, panel, RoomSelect } from './adminUi'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  fetchGradebook,
  MANUAL_CATEGORIES,
  setManualScore,
  type Gradebook,
  type GradebookRow,
  type ManualCategory,
} from './dbqAdminApi'
import { buildGradebookSheet, gradeOf, manualMax, parseScoreInput } from './gradebookModel'

// สมุดคะแนน: งานทุกชิ้น + คะแนนทุกหมวดตามน้ำหนัก + เกรด + ส่งออก Excel
export function DbqAdminGradebook() {
  const [room, setRoom] = useState<string | null>(null)
  const res = useAsync(() => fetchGradebook(room), [room])
  const [exporting, setExporting] = useState(false)

  const onExport = async (gb: Gradebook) => {
    setExporting(true)
    try {
      await downloadWorkbook(`DB-Quest-คะแนน-${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: 'สมุดคะแนน', rows: buildGradebookSheet(gb), colWidths: [8, 6, 10, 26, 10] },
      ])
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="สมุดคะแนน">
        <RoomSelect value={room} onChange={setRoom} />
        <Link to="/db/admin/exams" className={btn.secondary}>
          กรอกคะแนนสอบ/อื่น ๆ
        </Link>
        {res.status === 'success' && (
          <button type="button" className={btn.primary} disabled={exporting} onClick={() => void onExport(res.data)}>
            {exporting ? 'กำลังสร้างไฟล์…' : 'ส่งออก Excel'}
          </button>
        )}
      </PageHeader>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' && <GradebookTable gb={res.data} />}
    </div>
  )
}

function WorkCellView({ cell, max }: { cell: GradebookRow['work'][string] | undefined; max: number }) {
  if (!cell || cell.status === 'missing') return <span className="text-slate-300">–</span>
  if (cell.status === 'submitted')
    return (
      <Link to="/db/admin/grading" className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">
        รอตรวจ
      </Link>
    )
  return (
    <span className={cell.score != null && cell.score < max / 2 ? 'text-rose-600' : ''}>
      {cell.score}
    </span>
  )
}

function GradebookTable({ gb }: { gb: Gradebook }) {
  if (gb.rows.length === 0) return <p className={`${panel} text-slate-500`}>ยังไม่มีนักเรียน</p>
  return (
    <div className={`${panel} overflow-x-auto p-0`}>
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-dq-50 text-slate-600">
          <tr>
            <th className="sticky left-0 bg-dq-50 px-3 py-2">นักเรียน</th>
            {gb.assignments.map((a) => (
              <th key={a.id} className="px-2 py-2 text-center font-normal" title={a.title}>
                คาบ {a.session_no}
                <span className="block text-xs text-slate-400">เต็ม {a.max_score}</span>
              </th>
            ))}
            {CATEGORIES.map((c) => (
              <th key={c} className="border-l border-dq-100 px-2 py-2 text-center font-normal">
                {CATEGORY_LABEL[c]}
                <span className="block text-xs text-slate-400">{gb.weights[c] ?? 0}</span>
              </th>
            ))}
            <th className="border-l border-dq-100 px-3 py-2 text-center">รวม</th>
            <th className="px-3 py-2 text-center">เกรด</th>
          </tr>
        </thead>
        <tbody>
          {gb.rows.map((r) => (
            <tr key={r.id} className="border-t border-dq-50">
              <td className="sticky left-0 bg-white px-3 py-2">
                <Link to={`/db/admin/students/${r.id}`} className="text-dq-700 hover:underline">
                  {r.number ?? '-'}. {displayName(r)}
                </Link>
                <span className="block text-xs text-slate-400">{r.classroom_name}</span>
              </td>
              {gb.assignments.map((a) => (
                <td key={a.id} className="px-2 text-center">
                  <WorkCellView cell={r.work[a.id]} max={a.max_score} />
                </td>
              ))}
              {CATEGORIES.map((c) => {
                const s = r.scores.categories[c]
                return (
                  <td key={c} className="border-l border-dq-50 px-2 text-center">
                    {s?.points == null ? <span className="text-slate-300">–</span> : s.points}
                  </td>
                )
              })}
              <td className="border-l border-dq-50 px-3 text-center font-display text-dq-900">{r.scores.total}</td>
              <td className="px-3 text-center font-display">{gradeOf(r.scores)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-slate-500">
        ใบงานที่ยังไม่ส่งคิดเป็น 0 · เกมใช้คะแนนดีที่สุดของแต่ละเกม · หมวดที่ยังไม่กรอก ("–") ยังไม่นับ
      </p>
    </div>
  )
}

// กรอกคะแนนหมวดที่ระบบเก็บเองไม่ได้: ทดสอบท้ายหน่วย โครงงาน เข้าเรียน กลางภาค ปลายภาค
export function DbqAdminManualScores() {
  const [room, setRoom] = useState<string | null>(null)
  const [category, setCategory] = useState<ManualCategory>('midterm')
  const res = useAsync(() => fetchGradebook(room), [room])

  return (
    <div className="space-y-4">
      <PageHeader title="กรอกคะแนนสอบ/อื่น ๆ">
        <select className={input} aria-label="หมวดคะแนน" value={category} onChange={(e) => setCategory(e.target.value as ManualCategory)}>
          {MANUAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <RoomSelect value={room} onChange={setRoom} />
        <Link to="/db/admin/gradebook" className={btn.secondary}>
          ดูสมุดคะแนน
        </Link>
      </PageHeader>
      <p className="text-slate-600">
        กรอกคะแนนดิบตามคะแนนเต็มที่ตั้ง ระบบแปลงเป็นสัดส่วนตามน้ำหนักให้เอง ลบตัวเลขออก = ยังไม่มีคะแนน บันทึกทันทีเมื่อออกจากช่อง
      </p>
      {res.status === 'loading' && <LoadingBlock />}
      {res.status === 'error' && <ErrorBlock message={res.error} onRetry={res.reload} />}
      {res.status === 'success' && <ManualTable key={`${room}:${category}`} gb={res.data} category={category} onSaved={res.reload} />}
    </div>
  )
}

type CellState = 'saving' | 'saved' | 'error'

function ManualTable({ gb, category, onSaved }: { gb: Gradebook; category: ManualCategory; onSaved: () => void }) {
  const [max, setMax] = useState(String(manualMax(gb, category)))
  const [cells, setCells] = useState<Record<string, CellState>>({})
  const maxNum = Number(max)
  const maxOk = Number.isFinite(maxNum) && maxNum > 0

  const save = async (r: GradebookRow, text: string) => {
    const current = r.manual[category]
    const parsed = parseScoreInput(text, maxNum)
    if (!maxOk || !parsed.ok) {
      setCells((c) => ({ ...c, [r.id]: 'error' }))
      return
    }
    if (parsed.value === (current?.score ?? null) && (parsed.value == null || current?.max === maxNum)) return
    setCells((c) => ({ ...c, [r.id]: 'saving' }))
    try {
      await setManualScore(r.id, category, parsed.value, maxNum)
      setCells((c) => ({ ...c, [r.id]: 'saved' }))
    } catch {
      setCells((c) => ({ ...c, [r.id]: 'error' }))
    }
  }

  if (gb.rows.length === 0) return <p className={`${panel} text-slate-500`}>ยังไม่มีนักเรียน</p>
  return (
    <div className={`${panel} space-y-3`}>
      <label className="flex items-center gap-2 text-sm">
        <span>คะแนนเต็ม</span>
        <input className={`${input} w-24`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={!maxOk} />
        <span className="text-slate-500">
          → คิดเป็น {gb.weights[category] ?? 0} คะแนนในวิชา
        </span>
      </label>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2">นักเรียน</th>
            <th className="w-32">คะแนน</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {gb.rows.map((r) => {
            const st = cells[r.id]
            return (
              <tr key={r.id} className="border-t border-dq-50">
                <td className="py-1.5">
                  {r.classroom_name} · {r.number ?? '-'}. {displayName(r)}
                </td>
                <td>
                  <input
                    className={`${input} w-28 ${st === 'error' ? 'border-rose-400' : ''}`}
                    inputMode="decimal"
                    aria-label={`คะแนน ${r.name}`}
                    defaultValue={r.manual[category]?.score ?? ''}
                    onBlur={(e) => void save(r, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                    }}
                  />
                </td>
                <td className="text-xs">
                  {st === 'saving' && <span className="text-slate-500">กำลังบันทึก…</span>}
                  {st === 'saved' && <span className="text-emerald-700">✓ บันทึกแล้ว</span>}
                  {st === 'error' && <span className="text-rose-600">0–{maxOk ? maxNum : '?'}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button type="button" className={btn.secondary} onClick={onSaved}>
        โหลดคะแนนล่าสุด
      </button>
    </div>
  )
}
