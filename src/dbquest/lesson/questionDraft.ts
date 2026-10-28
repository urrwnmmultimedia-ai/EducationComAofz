import type { Question } from '@/content/lesson'

// คำตอบที่นักเรียนกำลังทำ = รูปแบบเดียวกับที่ส่งให้ dbq_check_answer
//   mcq {choice} | multi {choices[]} | fill {text} | order {order[]} | match/classify {pairs{}}
export type Draft =
  | { choice: number | null }
  | { choices: number[] }
  | { text: string }
  | { order: string[] }
  | { pairs: Record<string, string> }

export function initialDraft(q: Question): Draft {
  switch (q.type) {
    case 'mcq':
      return { choice: null }
    case 'multi':
      return { choices: [] }
    case 'fill':
      return { text: '' }
    case 'order':
      return { order: q.items.map((i) => i.id) }
    case 'match':
    case 'classify':
      return { pairs: {} }
  }
}

// ตอบครบพอจะกดตรวจได้หรือยัง (ลำดับเรียงถือว่าครบเสมอ)
export function isDraftComplete(q: Question, d: Draft): boolean {
  switch (q.type) {
    case 'mcq':
      return 'choice' in d && d.choice !== null
    case 'multi':
      return 'choices' in d && d.choices.length > 0
    case 'fill':
      return 'text' in d && d.text.trim().length > 0
    case 'order':
      return true
    case 'match':
      return 'pairs' in d && q.left.every((l) => d.pairs[l.id])
    case 'classify':
      return 'pairs' in d && q.items.every((i) => d.pairs[i.id])
  }
}

export function toggleChoice(choices: number[], i: number): number[] {
  return choices.includes(i) ? choices.filter((c) => c !== i) : [...choices, i].sort((a, b) => a - b)
}

export function moveId(order: string[], from: number, to: number): string[] {
  if (to < 0 || to >= order.length) return order
  const next = [...order]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}
