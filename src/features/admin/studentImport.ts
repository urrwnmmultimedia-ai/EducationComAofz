import { z } from 'zod'

// คอลัมน์ที่รองรับ (หัวตารางภาษาไทยหรืออังกฤษ)
const HEADER_ALIASES: Record<keyof ImportRow, string[]> = {
  student_code: ['รหัส', 'รหัสนักเรียน', 'เลขประจำตัว', 'student_code', 'code', 'id'],
  prefix: ['คำนำหน้า', 'คำนำหน้าชื่อ', 'prefix'],
  first_name: ['ชื่อ', 'first_name', 'firstname', 'name'],
  last_name: ['นามสกุล', 'สกุล', 'last_name', 'lastname', 'surname'],
  nickname: ['ชื่อเล่น', 'nickname'],
  classroom: ['ห้อง', 'ชั้น/ห้อง', 'classroom', 'class', 'room'],
  number: ['เลขที่', 'number', 'no'],
}

export const importRowSchema = z.object({
  student_code: z.string().regex(/^[0-9]{3,12}$/, 'รหัสต้องเป็นตัวเลข 3–12 หลัก'),
  prefix: z.string().max(30),
  first_name: z.string().min(1, 'ไม่มีชื่อ').max(80),
  last_name: z.string().max(80),
  nickname: z.string().max(40),
  classroom: z.string().max(30),
  number: z.number().int().min(1).max(99).nullable(),
})
export type ImportRow = z.infer<typeof importRowSchema>

export interface ImportIssue {
  line: number // เลขแถวในไฟล์ (1 = หัวตาราง)
  message: string
}

export interface ImportResult {
  rows: ImportRow[]
  issues: ImportIssue[]
  missingColumns: string[]
}

const norm = (v: unknown) => String(v ?? '').trim()

// "3/1" หรือ "1" => "ม.3/1" (grade = ชั้นของวิชาที่นำเข้า)
export function normalizeClassroom(raw: string, grade = 3): string {
  const v = raw.trim()
  if (!v) return ''
  if (/^\d+$/.test(v)) return `ม.${grade}/${v}`
  if (/^\d+\/\d+$/.test(v)) return `ม.${v}`
  return v.replace(/^ม\s*\.?\s*/, 'ม.')
}

// แปลงตาราง (แถวแรก = หัวตาราง) เป็นรายชื่อนักเรียนที่ตรวจแล้ว
export function parseStudentTable(table: unknown[][], grade = 3): ImportResult {
  const [header, ...body] = table
  const headers = (header ?? []).map((h) => norm(h).toLowerCase())
  const colIndex = {} as Record<keyof ImportRow, number>
  for (const key of Object.keys(HEADER_ALIASES) as (keyof ImportRow)[]) {
    colIndex[key] = headers.findIndex((h) => HEADER_ALIASES[key].some((a) => a.toLowerCase() === h))
  }
  const missingColumns = (['student_code', 'first_name'] as const).filter((k) => colIndex[k] < 0).map((k) => HEADER_ALIASES[k][0] ?? k)
  if (missingColumns.length > 0) return { rows: [], issues: [], missingColumns }

  const get = (row: unknown[], key: keyof ImportRow) => (colIndex[key] >= 0 ? norm(row[colIndex[key]]) : '')
  const rows: ImportRow[] = []
  const issues: ImportIssue[] = []
  const seen = new Set<string>()

  body.forEach((row, i) => {
    const line = i + 2
    if (row.every((c) => norm(c) === '')) return
    const numberText = get(row, 'number')
    const candidate = {
      student_code: get(row, 'student_code').replace(/\s/g, ''),
      prefix: get(row, 'prefix'),
      first_name: get(row, 'first_name'),
      last_name: get(row, 'last_name'),
      nickname: get(row, 'nickname'),
      classroom: normalizeClassroom(get(row, 'classroom'), grade),
      number: numberText === '' ? null : Number(numberText),
    }
    const parsed = importRowSchema.safeParse(candidate)
    if (!parsed.success) {
      issues.push({ line, message: parsed.error.issues.map((x) => x.message).join(', ') })
      return
    }
    if (seen.has(parsed.data.student_code)) {
      issues.push({ line, message: `รหัส ${parsed.data.student_code} ซ้ำในไฟล์` })
      return
    }
    seen.add(parsed.data.student_code)
    rows.push(parsed.data)
  })

  return { rows, issues, missingColumns: [] }
}

export const IMPORT_TEMPLATE_HEADER = ['รหัส', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น', 'ห้อง', 'เลขที่']
