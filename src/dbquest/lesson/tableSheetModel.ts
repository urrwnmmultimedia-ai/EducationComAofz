// ใบงานแบบ "ตาราง": นักเรียนออกแบบตาราง (ชื่อตาราง เขตข้อมูล ระเบียนตัวอย่าง คีย์หลัก + เหตุผล)
// เก็บเป็น JSON ในช่อง content.text เดิม (เซิร์ฟเวอร์รับใบงานแบบข้อความ) — หน้าครูแปลงกลับเป็นตารางได้

// why/query: ใบงานมีส่วน "ทำไมต้องใช้ฐานข้อมูล" และ "ตั้งคำถามสืบค้น (Query) + คำตอบจากข้อมูลตัวอย่าง"
export type TableSheetConfig = { minFields: number; maxFields: number; rows: number; why?: boolean; query?: boolean }

export type TableSheet = {
  kind: 'table'
  system: string
  table: string
  fields: string[]
  rows: string[][]
  pk: number | null
  reason: string
  why: string
  query: string
  queryResult: string
}

export function emptySheet(cfg: TableSheetConfig): TableSheet {
  return {
    kind: 'table',
    system: '',
    table: '',
    fields: Array.from({ length: cfg.minFields }, () => ''),
    rows: Array.from({ length: cfg.rows }, () => Array.from({ length: cfg.minFields }, () => '')),
    pk: null,
    reason: '',
    why: '',
    query: '',
    queryResult: '',
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string'

// แปลงข้อความที่ส่งไปแล้วกลับเป็นตาราง (ไม่ใช่ใบงานแบบตาราง = null)
export function parseSheet(text: string | undefined): TableSheet | null {
  if (!text || !text.startsWith('{')) return null
  try {
    const o = JSON.parse(text) as Record<string, unknown>
    if (o.kind !== 'table' || !Array.isArray(o.fields) || !Array.isArray(o.rows)) return null
    const fields = o.fields.filter(isStr)
    const rows = o.rows.filter(Array.isArray).map((r: unknown[]) => fields.map((_, i) => (isStr(r[i]) ? r[i] : '')))
    const pk = typeof o.pk === 'number' && o.pk >= 0 && o.pk < fields.length ? o.pk : null
    return { kind: 'table', system: isStr(o.system) ? o.system : '', table: isStr(o.table) ? o.table : '', fields, rows, pk, reason: isStr(o.reason) ? o.reason : '', why: isStr(o.why) ? o.why : '', query: isStr(o.query) ? o.query : '', queryResult: isStr(o.queryResult) ? o.queryResult : '' }
  } catch {
    return null
  }
}

// โหลดฉบับที่เคยส่ง แล้วเติมช่องให้ครบตามโจทย์
export function loadSheet(text: string | undefined, cfg: TableSheetConfig): TableSheet {
  const s = parseSheet(text)
  if (!s) return emptySheet(cfg)
  const width = Math.min(cfg.maxFields, Math.max(cfg.minFields, s.fields.length))
  const pad = (a: string[]) => Array.from({ length: width }, (_, i) => a[i] ?? '')
  const rows = Array.from({ length: Math.max(cfg.rows, s.rows.length) }, (_, r) => pad(s.rows[r] ?? []))
  return { ...s, fields: pad(s.fields), rows, pk: s.pk != null && s.pk < width ? s.pk : null }
}

export function serializeSheet(s: TableSheet): string {
  const t = (v: string) => v.trim()
  return JSON.stringify({ ...s, system: t(s.system), table: t(s.table), fields: s.fields.map(t), rows: s.rows.map((r) => r.map(t)), reason: t(s.reason), why: t(s.why), query: t(s.query), queryResult: t(s.queryResult) })
}

export function addField(s: TableSheet): TableSheet {
  return { ...s, fields: [...s.fields, ''], rows: s.rows.map((r) => [...r, '']) }
}

export function removeField(s: TableSheet, col: number): TableSheet {
  const pk = s.pk == null || s.pk === col ? null : s.pk > col ? s.pk - 1 : s.pk
  return { ...s, fields: s.fields.filter((_, i) => i !== col), rows: s.rows.map((r) => r.filter((_, i) => i !== col)), pk }
}

// สิ่งที่ยังขาดก่อนส่ง (ว่าง = ส่งได้)
export function missingParts(s: TableSheet, cfg: TableSheetConfig): string[] {
  const out: string[] = []
  if (!s.system.trim()) out.push('ระบบที่เลือก')
  if (!s.table.trim()) out.push('ชื่อตาราง')
  const named = s.fields.map((f, i) => (f.trim() ? i : -1)).filter((i) => i >= 0)
  if (named.length < cfg.minFields) out.push(`ชื่อเขตข้อมูลอย่างน้อย ${cfg.minFields} ช่อง`)
  const fullRows = s.rows.filter((r) => named.length > 0 && named.every((i) => r[i]?.trim())).length
  if (fullRows < cfg.rows) out.push(`ข้อมูลระเบียนให้ครบ ${cfg.rows} แถว`)
  if (s.pk == null || !s.fields[s.pk]?.trim()) out.push('เลือกคีย์หลัก')
  if (!s.reason.trim()) out.push('เหตุผลที่คีย์หลักไม่ซ้ำ')
  if (cfg.why && !s.why.trim()) out.push('ทำไมระบบนี้ต้องใช้ฐานข้อมูล')
  if (cfg.query && !s.query.trim()) out.push('คำถามสืบค้น (Query)')
  if (cfg.query && !s.queryResult.trim()) out.push('คำตอบของคำถามสืบค้น')
  return out
}

// ใบงานทีละหน้า: แต่ละหน้ารับผิดชอบส่วนที่ขาดของตัวเอง (ชื่อใน missingParts)
export type SheetPage = { id: 'system' | 'fields' | 'records' | 'pk' | 'query'; icon: string; title: string; parts: string[] }

export function sheetPages(cfg: TableSheetConfig): SheetPage[] {
  return [
    { id: 'system', icon: '🏪', title: 'เลือกระบบ', parts: ['ระบบที่เลือก', 'ทำไมระบบนี้ต้องใช้ฐานข้อมูล'] },
    { id: 'fields', icon: '🧩', title: 'ตารางและเขตข้อมูล', parts: ['ชื่อตาราง', `ชื่อเขตข้อมูลอย่างน้อย ${cfg.minFields} ช่อง`] },
    { id: 'records', icon: '📄', title: 'ระเบียนตัวอย่าง', parts: [`ข้อมูลระเบียนให้ครบ ${cfg.rows} แถว`] },
    { id: 'pk', icon: '🔑', title: 'คีย์หลัก', parts: ['เลือกคีย์หลัก', 'เหตุผลที่คีย์หลักไม่ซ้ำ'] },
    ...(cfg.query ? [{ id: 'query' as const, icon: '🔍', title: 'ลองสืบค้น', parts: ['คำถามสืบค้น (Query)', 'คำตอบของคำถามสืบค้น'] }] : []),
  ]
}

export function pageMissing(s: TableSheet, cfg: TableSheetConfig, page: SheetPage): string[] {
  const all = missingParts(s, cfg)
  return page.parts.filter((p) => all.includes(p))
}

// ค่าในคอลัมน์คีย์หลักซ้ำกันไหม (เตือนนักเรียน ไม่บังคับ)
export function pkHasDuplicates(s: TableSheet): boolean {
  if (s.pk == null) return false
  const vals = s.rows.map((r) => r[s.pk!]?.trim().toLowerCase()).filter(Boolean)
  return new Set(vals).size !== vals.length
}
