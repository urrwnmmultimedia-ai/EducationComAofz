import type { GuideSlot } from '@/content/lesson'

// ช่องไกด์คำตอบเปิดคาบ DB Quest: รวมคำตอบหลายช่องเป็นข้อความเดียว และดึงคำตอบเดิมกลับมาใส่ช่อง

export const FREE_SLOT: GuideSlot = { label: 'คำตอบของฉัน', hint: 'ตอบสั้น ๆ ตามที่คิด ไม่มีถูกผิด' }

// "ป้าย: คำตอบ" บรรทัดละช่อง (ช่องว่างไม่ใส่) — ช่องอิสระไม่ใส่ป้าย
export function composeGuide(slots: GuideSlot[], values: string[]): string {
  return slots
    .flatMap((s, i) => {
      const v = values[i]?.trim()
      if (!v) return []
      return [s === FREE_SLOT ? v : `${s.label}: ${v}`]
    })
    .join('\n')
}

// คำตอบที่บันทึกไว้ { slots: string[][] } → ตามรูปช่องปัจจุบัน (จำนวนช่องต่อข้อ) ถ้ารูปไม่ตรงใช้ช่องว่าง
export function savedSlots(saved: unknown, shape: number[]): string[][] {
  const raw = (saved as { slots?: unknown } | null | undefined)?.slots
  return shape.map((n, i) => {
    const row = Array.isArray(raw) ? (raw[i] as unknown) : undefined
    return Array.from({ length: n }, (_, j) => {
      const v = Array.isArray(row) ? (row[j] as unknown) : undefined
      return typeof v === 'string' ? v : ''
    })
  })
}
