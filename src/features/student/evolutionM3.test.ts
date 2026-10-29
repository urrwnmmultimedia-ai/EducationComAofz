import { describe, expect, it } from 'vitest'
import { M3_STAGES, m3EvolutionOf } from './evolutionM3'

describe('m3EvolutionOf', () => {
  it('starts as a monkey at 0', () => {
    const e = m3EvolutionOf(0)
    expect(e.index).toBe(0)
    expect(e.next?.name).toBe(M3_STAGES[1]?.name)
    expect(e.toNext).toBe(15)
  })

  it('moves up exactly at each threshold', () => {
    expect(m3EvolutionOf(14.9).index).toBe(0)
    expect(m3EvolutionOf(15).index).toBe(1)
    expect(m3EvolutionOf(50).index).toBe(3)
    expect(m3EvolutionOf(85).index).toBe(5)
  })

  it('reports progress inside the current band', () => {
    const e = m3EvolutionOf(40) // 30 → 50
    expect(e.progress).toBeCloseTo(0.5)
    expect(e.toNext).toBe(10)
  })

  it('is complete at the top and clamps bad input', () => {
    expect(m3EvolutionOf(100)).toMatchObject({ index: 5, next: null, toNext: 0, progress: 1 })
    expect(m3EvolutionOf(Number.NaN).index).toBe(0)
    expect(m3EvolutionOf(150).index).toBe(5)
  })
})
