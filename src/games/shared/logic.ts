// ตัวตรวจคำตอบของเกมทุก engine (ฟังก์ชันล้วน ทดสอบได้)
import type { IdeaConfig, QuizItem, SequenceConfig, ShopConfig, SortConfig } from './schemas'
import type { Mistake } from './types'

export interface Graded {
  correct: number
  total: number
  mistakes: Mistake[]
}

// ---------- ควิซ ----------
export function gradeQuizAnswer(item: QuizItem, chosen: number | null): { ok: boolean; mistake?: Mistake } {
  const ok = chosen === item.answer
  return ok
    ? { ok }
    : {
        ok,
        mistake: {
          prompt: item.q,
          yours: chosen == null ? 'ไม่ได้ตอบ (หมดเวลา)' : (item.choices[chosen] ?? '—'),
          correct: item.choices[item.answer] ?? '—',
          explain: item.explain,
        },
      }
}

// ---------- จัดกลุ่ม ----------
export function gradeSort(config: Pick<SortConfig, 'cards' | 'buckets'>, placement: (string | null)[]): Graded {
  const label = (id: string | null) => config.buckets.find((b) => b.id === id)?.label ?? 'ยังไม่ได้จัด'
  const mistakes: Mistake[] = []
  let correct = 0
  config.cards.forEach((card, i) => {
    if (placement[i] === card.bucket) correct++
    else mistakes.push({ prompt: card.text, yours: label(placement[i] ?? null), correct: label(card.bucket), explain: card.explain })
  })
  return { correct, total: config.cards.length, mistakes }
}

// ---------- เรียงลำดับ ----------
// order = ลำดับดัชนีของ items ที่นักเรียนเรียง; ได้คะแนนตามตำแหน่งที่ตรง
export function gradeSequence(config: Pick<SequenceConfig, 'items'>, order: number[]): Graded {
  const mistakes: Mistake[] = []
  let correct = 0
  config.items.forEach((item, pos) => {
    if (order[pos] === pos) correct++
    else mistakes.push({ prompt: `ลำดับที่ ${pos + 1}`, yours: config.items[order[pos] ?? -1] ?? '—', correct: item })
  })
  return { correct, total: config.items.length, mistakes }
}

export function gradeMatch(config: Pick<SequenceConfig, 'items' | 'match'>, chosen: (number | null)[]): Graded {
  const match = config.match ?? []
  const mistakes: Mistake[] = []
  let correct = 0
  match.forEach((m, i) => {
    if (chosen[i] === m.step) correct++
    else mistakes.push({ prompt: m.situation, yours: chosen[i] != null ? (config.items[chosen[i] as number] ?? '—') : 'ไม่ได้ตอบ', correct: config.items[m.step] ?? '—' })
  })
  return { correct, total: match.length, mistakes }
}

// สุ่มลำดับเริ่มต้นที่ไม่ตรงคำตอบ
export function scrambled(n: number, random: () => number = Math.random): number[] {
  for (let t = 0; t < 30; t++) {
    const idx = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j] as number, idx[i] as number]
    }
    if (n < 2 || idx.some((v, i) => v !== i)) return idx
  }
  return Array.from({ length: n }, (_, i) => n - 1 - i)
}

// ---------- บอส ----------
export interface BossState {
  stage: number
  index: number // ข้อในด่าน
  hearts: number
  bossHp: number // 0..1 ของด่านปัจจุบัน
  correct: number
  answered: number
  over: boolean
  won: boolean
}

export function bossInit(hearts: number): BossState {
  return { stage: 0, index: 0, hearts, bossHp: 1, correct: 0, answered: 0, over: false, won: false }
}

export function bossAnswer(state: BossState, ok: boolean, stageSizes: number[]): BossState {
  if (state.over) return state
  const size = stageSizes[state.stage] ?? 1
  const hearts = ok ? state.hearts : state.hearts - 1
  const correct = state.correct + (ok ? 1 : 0)
  const bossHp = ok ? Math.max(0, state.bossHp - 1 / size) : state.bossHp
  const lastInStage = state.index + 1 >= size
  const lastStage = state.stage + 1 >= stageSizes.length
  if (hearts <= 0) return { ...state, hearts: 0, correct, answered: state.answered + 1, bossHp, over: true, won: false }
  if (lastInStage) {
    if (lastStage) return { ...state, hearts, correct, answered: state.answered + 1, bossHp, over: true, won: true }
    return { stage: state.stage + 1, index: 0, hearts, bossHp: 1, correct, answered: state.answered + 1, over: false, won: false }
  }
  return { ...state, index: state.index + 1, hearts, correct, bossHp, answered: state.answered + 1 }
}

// ---------- เส้นทาง ----------
export type Cell = [number, number]
const key = (c: Cell) => `${c[0]},${c[1]}`

export function isAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1
}

export function shortestPathLength(grid: { rows: number; cols: number; start: Cell; goal: Cell; walls: Cell[] }): number | null {
  const walls = new Set(grid.walls.map(key))
  const seen = new Set([key(grid.start)])
  let frontier: Cell[] = [grid.start]
  let steps = 0
  while (frontier.length) {
    const next: Cell[] = []
    for (const c of frontier) {
      if (c[0] === grid.goal[0] && c[1] === grid.goal[1]) return steps
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const n: Cell = [c[0] + dr, c[1] + dc]
        if (n[0] < 0 || n[1] < 0 || n[0] >= grid.rows || n[1] >= grid.cols) continue
        if (walls.has(key(n)) || seen.has(key(n))) continue
        seen.add(key(n))
        next.push(n)
      }
    }
    frontier = next
    steps++
  }
  return null
}

// path รวมจุดเริ่ม; คะแนน: 1 = สั้นที่สุด, 0.5 = ถึงแต่ยาวกว่า, 0 = ไม่ถึง/ผิดกติกา
export function gradeRoute(grid: { rows: number; cols: number; start: Cell; goal: Cell; walls: Cell[] }, path: Cell[]): number {
  const walls = new Set(grid.walls.map(key))
  if (!path.length || key(path[0] as Cell) !== key(grid.start)) return 0
  for (let i = 1; i < path.length; i++) {
    const c = path[i] as Cell
    if (!isAdjacent(path[i - 1] as Cell, c) || walls.has(key(c))) return 0
  }
  if (key(path[path.length - 1] as Cell) !== key(grid.goal)) return 0
  const best = shortestPathLength(grid)
  return best != null && path.length - 1 === best ? 1 : 0.5
}

// ---------- เลือกแนวคิด ----------
// ratings[idea][criterion] 1–3; ตรง = 1 แต้ม, ต่าง 1 = 0.5; เลือกแนวคิดดีที่สุดถูก = 3; เหตุผลถูก = 2
export function bestIdeaIndex(config: Pick<IdeaConfig, 'ideas'>): number {
  let best = 0
  config.ideas.forEach((idea, i) => {
    const sum = idea.truth.reduce((s, v) => s + v, 0)
    const bestSum = (config.ideas[best]?.truth ?? []).reduce((s, v) => s + v, 0)
    if (sum > bestSum) best = i
  })
  return best
}

export function gradeIdea(config: IdeaConfig, ratings: number[][], chosenIdea: number | null, chosenReason: number | null): Graded {
  let points = 0
  const mistakes: Mistake[] = []
  config.ideas.forEach((idea, i) =>
    idea.truth.forEach((t, c) => {
      const r = ratings[i]?.[c] ?? 0
      if (r === t) points += 1
      else if (Math.abs(r - t) === 1) points += 0.5
    }),
  )
  const cells = config.ideas.length * config.criteria.length
  const best = bestIdeaIndex(config)
  if (chosenIdea === best) points += 3
  else mistakes.push({ prompt: 'แนวคิดที่ดีที่สุด', yours: config.ideas[chosenIdea ?? -1]?.name ?? 'ไม่ได้เลือก', correct: config.ideas[best]?.name ?? '' })
  const reason = config.reasons[chosenReason ?? -1]
  if (reason?.correct) points += 2
  else mistakes.push({ prompt: 'เหตุผลที่เลือก', yours: reason?.text ?? 'ไม่ได้เลือก', correct: config.reasons.find((r) => r.correct)?.text ?? '' })
  return { correct: points, total: cells + 5, mistakes }
}

// ---------- ร้านเพิ่มมูลค่า ----------
export function bestShopValue(upgrades: { cost: number; value: number }[], budget: number): number {
  let best = 0
  const n = upgrades.length
  for (let mask = 0; mask < 1 << n; mask++) {
    let cost = 0
    let value = 0
    for (let i = 0; i < n; i++)
      if (mask & (1 << i)) {
        cost += (upgrades[i] as { cost: number }).cost
        value += (upgrades[i] as { value: number }).value
      }
    if (cost <= budget && value > best) best = value
  }
  return best
}

export function gradeShop(product: ShopConfig['products'][number], picked: boolean[]): { value: number; cost: number; best: number; pct: number; overBudget: boolean } {
  let cost = 0
  let value = 0
  product.upgrades.forEach((u, i) => {
    if (picked[i]) {
      cost += u.cost
      value += u.value
    }
  })
  const best = bestShopValue(product.upgrades, product.budget)
  const overBudget = cost > product.budget
  return { value, cost, best, overBudget, pct: overBudget || best === 0 ? 0 : Math.round((value / best) * 100) }
}
