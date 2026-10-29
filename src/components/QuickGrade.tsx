// ตัวช่วยตรวจงานเร็ว (ใช้ทั้งหน้าครู ม.3 และ DB Quest): ปุ่มคะแนนลัด + คอมเมนต์สำเร็จรูป

// คะแนนลัด: เต็ม / ¾ / ½ / 0 (ปัดครึ่งคะแนน ไม่ซ้ำกัน)
export function quickScores(max: number): number[] {
  const half = (n: number) => Math.round(n * 2) / 2
  return [...new Set([max, half(max * 0.75), half(max * 0.5), 0])]
}

export function ScoreQuickPicks({
  max,
  value,
  onPick,
  disabled,
}: {
  max: number
  value: string
  onPick: (score: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="คะแนนลัด">
      {quickScores(max).map((v) => {
        const on = value.trim() !== '' && Number(value) === v
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onPick(v)}
            className={`tq-press min-h-9 rounded-xl px-3 font-display text-sm shadow-sm ring-1 disabled:opacity-50 ${
              on
                ? 'bg-brand-600 text-white ring-brand-600'
                : v === max
                  ? 'bg-mint-400/15 text-emerald-800 ring-mint-400/60 hover:bg-mint-400/25'
                  : 'bg-white text-slate-700 ring-brand-200 hover:bg-brand-50'
            }`}
          >
            {v === max ? `เต็ม ${v}` : v}
          </button>
        )
      })}
    </div>
  )
}

export const FEEDBACK_CHIPS = [
  'ดีมาก ครบถ้วน 👍',
  'ถูกต้อง แต่อธิบายเพิ่มอีกนิด',
  'ลองยกตัวอย่างประกอบ',
  'ยังไม่ครบตามโจทย์ แก้แล้วส่งใหม่นะ',
  'ระวังคำสะกด',
  'ครั้งหน้าส่งให้ตรงเวลานะ',
]

// กดเพื่อเติมคอมเมนต์สำเร็จรูป (กดซ้ำเพื่อเอาออก)
export function FeedbackChips({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const toggle = (chip: string) => {
    const parts = value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    onChange((parts.includes(chip) ? parts.filter((p) => p !== chip) : [...parts, chip]).join('\n'))
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="คอมเมนต์สำเร็จรูป">
      {FEEDBACK_CHIPS.map((c) => {
        const on = value.split('\n').some((l) => l.trim() === c)
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(c)}
            className={`rounded-full px-3 py-1 text-xs ring-1 transition disabled:opacity-50 ${
              on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-brand-200 hover:bg-brand-50'
            }`}
          >
            {c}
          </button>
        )
      })}
    </div>
  )
}
