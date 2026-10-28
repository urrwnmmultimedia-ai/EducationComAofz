// วิเคราะห์ข้อสอบแบบง่าย
//   p (ค่าความยาก) = สัดส่วนคนตอบถูก
//   r (อำนาจจำแนก) = (สัดส่วนถูกของกลุ่มสูง − กลุ่มต่ำ) โดยแบ่งกลุ่มละ 27% ตามคะแนนรวม
export interface AttemptScores {
  total: number
  points: Record<string, number | null> // question_id -> 0..1 (null = รอตรวจ)
}

export interface ItemStat {
  questionId: string
  n: number
  p: number | null
  r: number | null
  level: 'ง่ายมาก' | 'ง่าย' | 'พอดี' | 'ยาก' | 'ยากมาก' | '–'
  discrimination: 'ดี' | 'พอใช้' | 'ควรปรับปรุง' | '–'
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function analyzeItems(questionIds: string[], attempts: AttemptScores[]): ItemStat[] {
  const sorted = [...attempts].sort((a, b) => b.total - a.total)
  const g = sorted.length >= 4 ? Math.max(1, Math.round(sorted.length * 0.27)) : 0
  const upper = sorted.slice(0, g)
  const lower = g ? sorted.slice(-g) : []

  const mean = (list: AttemptScores[], id: string) => {
    const vals = list.map((a) => a.points[id]).filter((v): v is number => typeof v === 'number')
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  return questionIds.map((id) => {
    const scored = attempts.filter((a) => typeof a.points[id] === 'number')
    const p = scored.length ? round2(scored.reduce((s, a) => s + (a.points[id] as number), 0) / scored.length) : null
    const hi = g ? mean(upper, id) : null
    const lo = g ? mean(lower, id) : null
    const r = hi != null && lo != null ? round2(hi - lo) : null
    return { questionId: id, n: scored.length, p, r, level: levelOf(p), discrimination: discOf(r) }
  })
}

function levelOf(p: number | null): ItemStat['level'] {
  if (p == null) return '–'
  if (p > 0.8) return 'ง่ายมาก'
  if (p > 0.6) return 'ง่าย'
  if (p >= 0.4) return 'พอดี'
  if (p >= 0.2) return 'ยาก'
  return 'ยากมาก'
}

function discOf(r: number | null): ItemStat['discrimination'] {
  if (r == null) return '–'
  if (r >= 0.4) return 'ดี'
  if (r >= 0.2) return 'พอใช้'
  return 'ควรปรับปรุง'
}
