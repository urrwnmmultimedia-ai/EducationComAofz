import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  bestIdeaIndex,
  bestShopValue,
  bossAnswer,
  bossInit,
  gradeIdea,
  gradeMatch,
  gradeQuizAnswer,
  gradeRoute,
  gradeSequence,
  gradeShop,
  gradeSort,
  scrambled,
  shortestPathLength,
  type Cell,
} from './logic'
import { parseGameConfig, type IdeaConfig } from './schemas'
import { toScore } from './types'

describe('quiz', () => {
  const item = { q: 'ข้อ', choices: ['a', 'b', 'c'], answer: 2, explain: 'เพราะ' }
  it('ตอบถูก/ผิด/หมดเวลา', () => {
    expect(gradeQuizAnswer(item, 2).ok).toBe(true)
    expect(gradeQuizAnswer(item, 0).mistake).toEqual({ prompt: 'ข้อ', yours: 'a', correct: 'c', explain: 'เพราะ' })
    expect(gradeQuizAnswer(item, null).mistake?.yours).toContain('หมดเวลา')
  })
})

describe('sort', () => {
  const cfg = {
    buckets: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    cards: [
      { text: 'x', bucket: 'a' },
      { text: 'y', bucket: 'b' },
      { text: 'z', bucket: 'b' },
    ],
  }
  it('นับถูกและบอกข้อผิด', () => {
    const g = gradeSort(cfg, ['a', 'a', null])
    expect(g.correct).toBe(1)
    expect(g.mistakes.map((m) => m.yours)).toEqual(['A', 'ยังไม่ได้จัด'])
  })
})

describe('sequence', () => {
  const cfg = { items: ['1', '2', '3', '4'], match: [{ situation: 's', step: 2 }] }
  it('ได้คะแนนตามตำแหน่ง', () => {
    expect(gradeSequence(cfg, [0, 1, 2, 3]).correct).toBe(4)
    expect(gradeSequence(cfg, [1, 0, 2, 3]).correct).toBe(2)
  })
  it('จับคู่สถานการณ์', () => {
    expect(gradeMatch(cfg, [2]).correct).toBe(1)
    expect(gradeMatch(cfg, [null]).mistakes[0]?.yours).toBe('ไม่ได้ตอบ')
  })
  it('scrambled ไม่ตรงลำดับเดิม', () => {
    expect(scrambled(5, () => 0.999)).not.toEqual([0, 1, 2, 3, 4])
    expect([...scrambled(5)].sort()).toEqual([0, 1, 2, 3, 4])
  })
})

describe('boss', () => {
  it('ตอบถูกลดพลังบอส ผิดเสียหัวใจ', () => {
    let s = bossInit(3)
    s = bossAnswer(s, true, [4])
    expect(s.bossHp).toBe(0.75)
    s = bossAnswer(s, false, [4])
    expect(s.hearts).toBe(2)
    expect(s.index).toBe(2)
  })
  it('หัวใจหมด = แพ้', () => {
    let s = bossInit(1)
    s = bossAnswer(s, false, [3])
    expect(s).toMatchObject({ over: true, won: false, hearts: 0 })
  })
  it('หลายด่าน: จบด่านแล้วบอสใหม่พลังเต็ม แต่หัวใจไม่เติม', () => {
    let s = bossInit(3)
    s = bossAnswer(s, false, [1, 2])
    expect(s).toMatchObject({ stage: 1, index: 0, bossHp: 1, hearts: 2 })
    s = bossAnswer(s, true, [1, 2])
    s = bossAnswer(s, true, [1, 2])
    expect(s).toMatchObject({ over: true, won: true, correct: 2, answered: 3 })
  })
})

describe('route', () => {
  const grid = { rows: 3, cols: 3, start: [0, 0] as Cell, goal: [2, 2] as Cell, walls: [[1, 1]] as Cell[] }
  it('BFS หาเส้นทางสั้นสุด', () => {
    expect(shortestPathLength(grid)).toBe(4)
    expect(shortestPathLength({ ...grid, walls: [[0, 1], [1, 0]] })).toBeNull()
  })
  it('ตรวจเส้นทาง', () => {
    const best: Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]
    expect(gradeRoute(grid, best)).toBe(1)
    const longer: Cell[] = [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1]]
    expect(gradeRoute(grid, longer)).toBe(0) // ทะลุกำแพง
    const notAdj: Cell[] = [[0, 0], [2, 2]]
    expect(gradeRoute(grid, notAdj)).toBe(0)
    const wide = { rows: 3, cols: 4, start: [0, 0] as Cell, goal: [0, 2] as Cell, walls: [] as Cell[] }
    expect(gradeRoute(wide, [[0, 0], [1, 0], [1, 1], [1, 2], [0, 2]])).toBe(0.5)
  })
})

describe('idea', () => {
  const cfg: IdeaConfig = {
    engine: 'idea',
    instructions: '',
    problem: 'p',
    criteria: ['c1', 'c2'],
    ideas: [
      { name: 'A', desc: '', truth: [3, 1] },
      { name: 'B', desc: '', truth: [2, 3] },
    ],
    reasons: [
      { text: 'r1', correct: true },
      { text: 'r2', correct: false },
    ],
  }
  it('หาแนวคิดที่ดีที่สุด', () => {
    expect(bestIdeaIndex(cfg)).toBe(1)
  })
  it('คะแนนเต็ม และคะแนนบางส่วน', () => {
    expect(gradeIdea(cfg, [[3, 1], [2, 3]], 1, 0)).toMatchObject({ correct: 9, total: 9 })
    const g = gradeIdea(cfg, [[2, 1], [2, 1]], 0, 1)
    expect(g.correct).toBe(2.5) // 0.5 + 1 + 1 + 0
    expect(g.mistakes).toHaveLength(2)
  })
})

describe('shop', () => {
  const product = {
    name: 'p',
    emoji: '',
    basePrice: 20,
    budget: 10,
    upgrades: [
      { name: 'a', kind: '', cost: 6, value: 7 },
      { name: 'b', kind: '', cost: 4, value: 6 },
      { name: 'c', kind: '', cost: 5, value: 4 },
    ],
  }
  it('หาชุดอัปเกรดที่คุ้มที่สุดภายใต้งบ', () => {
    expect(bestShopValue(product.upgrades, 10)).toBe(13)
  })
  it('ให้คะแนนเทียบแผนที่ดีที่สุด และเกินงบได้ 0', () => {
    expect(gradeShop(product, [true, true, false]).pct).toBe(100)
    expect(gradeShop(product, [false, true, true]).pct).toBe(77)
    expect(gradeShop(product, [true, true, true])).toMatchObject({ overBudget: true, pct: 0 })
  })
})

describe('toScore', () => {
  it('แปลงเป็น 0–100', () => {
    expect(toScore({ correct: 3, total: 4, mistakes: [] })).toBe(75)
    expect(toScore({ correct: 0, total: 0, mistakes: [] })).toBe(0)
    expect(toScore({ correct: 0, total: 1, mistakes: [], scoreOverride: 120 })).toBe(100)
  })
})

describe('seed games.json', () => {
  const games = JSON.parse(readFileSync('supabase/games/games.json', 'utf8')) as { slug: string; config: unknown }[]
  it.each(games.map((g) => [g.slug, g.config] as const))('%s config ถูกรูปแบบ', (_slug, config) => {
    const r = parseGameConfig(config)
    if (!r.ok) throw new Error(r.error)
  })
  it('เส้นทางทุกด่านไปถึงได้', () => {
    for (const g of games) {
      const r = parseGameConfig(g.config)
      if (r.ok && r.config.engine === 'route') for (const grid of r.config.grids) expect(shortestPathLength(grid)).not.toBeNull()
    }
  })
})
