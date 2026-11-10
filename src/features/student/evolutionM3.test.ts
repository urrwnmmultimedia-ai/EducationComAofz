import { describe, expect, it } from 'vitest'
import { M3_STAGES, m3EvolutionOf } from './evolutionM3'

describe('m3EvolutionOf (8 main stages = grade 0–4, minor steps every 10 below 50)', () => {
  it('starts as a monkey at 0', () => {
    const e = m3EvolutionOf(0)
    expect(e.index).toBe(0)
    expect(e.next?.name).toBe(M3_STAGES[1]?.name)
    expect(e.toNext).toBe(10)
    expect(e.next?.minor).toBe(1)
  })

  it('moves up exactly at each grade threshold', () => {
    expect([0, 10, 20, 30, 40].map((s) => m3EvolutionOf(s).stage.minor)).toEqual([0, 1, 2, 3, 4])
    expect(m3EvolutionOf(49.9)).toMatchObject({ main: 0, stage: { minor: 4, grade: '0' } })
    expect(m3EvolutionOf(50)).toMatchObject({ main: 1, stage: { minor: 0 } })
    expect(m3EvolutionOf(64.99).stage.grade).toBe('2')
    expect(m3EvolutionOf(65).stage.name).toBe('มนุษย์นักเพาะปลูก')
    expect(m3EvolutionOf(75).stage.name).toBe('มนุษย์นักออกแบบ')
    expect(m3EvolutionOf(80).stage.grade).toBe('4')
  })

  it('reports progress inside the current band', () => {
    const e = m3EvolutionOf(62.5) // 60 → 65
    expect(e.progress).toBeCloseTo(0.5)
    expect(e.toNext).toBe(2.5)
  })

  it('is complete at the top and clamps bad input', () => {
    expect(m3EvolutionOf(100)).toMatchObject({ index: 11, main: 7, next: null, toNext: 0, progress: 1 })
    expect(m3EvolutionOf(Number.NaN).index).toBe(0)
    expect(m3EvolutionOf(150).main).toBe(7)
  })
})
