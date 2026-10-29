// กติกา Memory Match (ไม่มี UI) — สำรับมาจากเซิร์ฟเวอร์ผ่าน dbq_game_deck

export interface Pair {
  id: string
  term: string
  meaning: string
}

export interface Card {
  key: string
  pairId: string
  side: 'term' | 'meaning'
  text: string
}

export interface MatchState {
  cards: Card[]
  open: number[] // ไพ่ที่หงายอยู่ (ยังไม่จับคู่) ไม่เกิน 2 ใบ
  matched: string[] // pairId ที่จับคู่ได้แล้ว
  moves: number
  misses: number
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j] as T, a[i] as T]
  }
  return a
}

export function newGame(pairs: Pair[], random: () => number = Math.random): MatchState {
  const cards = pairs.flatMap((p): Card[] => [
    { key: `${p.id}:t`, pairId: p.id, side: 'term', text: p.term },
    { key: `${p.id}:m`, pairId: p.id, side: 'meaning', text: p.meaning },
  ])
  return { cards: shuffle(cards, random), open: [], matched: [], moves: 0, misses: 0 }
}

// หงายเปิดผิด 2 ใบแล้ว ต้องรอคว่ำ (hide) ก่อนเปิดใบใหม่
export function isWaiting(s: MatchState): boolean {
  return s.open.length === 2
}

export function canFlip(s: MatchState, i: number): boolean {
  const card = s.cards[i]
  return !!card && !isWaiting(s) && !s.open.includes(i) && !s.matched.includes(card.pairId)
}

export function flip(s: MatchState, i: number): MatchState {
  const first = s.open[0]
  if (!canFlip(s, i)) return s
  if (first === undefined) return { ...s, open: [i] }
  const a = s.cards[first]
  const b = s.cards[i]
  if (a && b && a.pairId === b.pairId) {
    return { ...s, open: [], matched: [...s.matched, a.pairId], moves: s.moves + 1 }
  }
  return { ...s, open: [first, i], moves: s.moves + 1, misses: s.misses + 1 }
}

export function hide(s: MatchState): MatchState {
  return isWaiting(s) ? { ...s, open: [] } : s
}

export function isComplete(s: MatchState): boolean {
  return s.matched.length * 2 === s.cards.length
}

// คะแนน 0-100 จากเวลาที่ใช้เท่านั้น (ไม่นับครั้งที่เปิดผิด และไม่มีหมดเวลา)
// จบภายในเวลาเป้าหมาย = 100 จากนั้นลดลงเรื่อย ๆ จนเหลือ 40 ที่ 3 เท่าของเวลาเป้าหมาย (ต่ำสุด 40)
export function timeScore(durationSec: number, targetSec: number): number {
  if (durationSec <= targetSec) return 100
  return Math.max(40, Math.floor(100 - (60 * (durationSec - targetSec)) / (2 * targetSec)))
}

export function matchScore(s: MatchState, durationSec: number, targetSec: number): number {
  return s.cards.length > 0 && isComplete(s) ? timeScore(durationSec, targetSec) : 0
}

// เกณฑ์ดาวตรงกับ public.dbq_game_stars: >= 90 = 3, >= 70 = 2, >= 40 = 1
export function starsForScore(score: number): number {
  return score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0
}

// เวลานานสุด (วินาที) ที่ยังได้ 3 ดาว และ 2 ดาว
export function starDeadlines(targetSec: number): { three: number; two: number } {
  return { three: Math.floor(targetSec + targetSec / 3), two: targetSec * 2 }
}
