import { computeGrade, formatGrade } from '@/lib/grade'
import { CATEGORIES, CATEGORY_LABEL, type Gradebook, type ManualCategory, type Scores } from './dbqAdminApi'

// แปลงข้อมูลสมุดคะแนน (คำนวณแล้วที่เซิร์ฟเวอร์) เป็นตาราง/ไฟล์ Excel

export function gradeOf(scores: Scores): string {
  return formatGrade(computeGrade(scores.total))
}

// แปลงข้อความในช่องกรอกคะแนน: '' = ลบ, ตัวเลขนอกช่วง = error
export function parseScoreInput(text: string, max: number): { ok: true; value: number | null } | { ok: false } {
  const t = text.trim()
  if (t === '') return { ok: true, value: null }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

export function weightsTotal(w: Record<string, number>): number {
  return CATEGORIES.reduce((sum, c) => sum + (Number(w[c]) || 0), 0)
}

// คะแนนเต็มที่ใช้ล่าสุดของแต่ละหมวดที่ครูกรอกเอง (ค่าเริ่มต้น 100)
export function manualMax(gb: Gradebook, c: ManualCategory): number {
  return gb.manual_max[c] ?? 100
}

export function buildGradebookSheet(gb: Gradebook): unknown[][] {
  const header = [
    'ห้อง',
    'เลขที่',
    'รหัส',
    'ชื่อ',
    'ชื่อเล่น',
    ...gb.assignments.map((a) => `${a.title} (${a.max_score})`),
    ...CATEGORIES.map((c) => `${CATEGORY_LABEL[c]} (${gb.weights[c] ?? 0})`),
    'รวม (100)',
    'เกรด',
    'XP',
  ]
  const rows = gb.rows.map((r) => [
    r.classroom_name ?? '',
    r.number ?? '',
    r.student_code,
    r.name,
    r.nickname,
    ...gb.assignments.map((a) => {
      const w = r.work[a.id]
      return w?.status === 'graded' ? w.score : w?.status === 'submitted' ? 'รอตรวจ' : ''
    }),
    ...CATEGORIES.map((c) => r.scores.categories[c]?.points ?? ''),
    r.scores.total,
    gradeOf(r.scores),
    r.xp,
  ])
  return [header, ...rows]
}
