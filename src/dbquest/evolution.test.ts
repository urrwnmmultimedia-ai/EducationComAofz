import { describe, expect, it } from 'vitest'
import { EVO_STAGES, evolutionOf } from './evolution'

describe('วิวัฒนาการ DB Quest (8 ขั้นหลัก = เกรด 0–4 + ขั้นย่อยทุก 10 คะแนนก่อนผ่านเกณฑ์)', () => {
  it('เริ่มที่เจ้าทุยน้อย (เกรด 0) อีก 10 คะแนนถึงขั้นย่อยแรก', () => {
    const e = evolutionOf(0)
    expect(e.index).toBe(0)
    expect(e.main).toBe(0)
    expect(e.stage.name).toBe('เจ้าทุยน้อย')
    expect(e.stage.grade).toBe('0')
    expect(e.toNext).toBe(10)
    expect(e.next?.name).toBe('ทุยน้อยหัดเดิน')
  })

  it('ช่วง 0–49 วิวัฒนาการย่อยทุก 10 คะแนน ยังเป็นเกรด 0 และมีภาพของตัวเอง', () => {
    expect([0, 10, 20, 30, 40].map((s) => evolutionOf(s).stage.minor)).toEqual([0, 1, 2, 3, 4])
    expect(evolutionOf(19.99).stage.minor).toBe(1)
    for (const s of [10, 25, 40, 49.9]) expect(evolutionOf(s)).toMatchObject({ main: 0, stage: { grade: '0' } })
    expect(EVO_STAGES.map((s) => s.art)).toEqual(EVO_STAGES.map((_, i) => i))
    expect(evolutionOf(45).toNext).toBe(5)
  })

  it('ขั้นหลักขึ้นตรงเกณฑ์เกรด 50/55/60/65/70/75/80', () => {
    expect(evolutionOf(49.99).main).toBe(0)
    expect(evolutionOf(50)).toMatchObject({ main: 1, stage: { grade: '1', minor: 0 } })
    expect(evolutionOf(55).stage.grade).toBe('1.5')
    expect(evolutionOf(60).stage.grade).toBe('2')
    expect(evolutionOf(65).stage.grade).toBe('2.5')
    expect(evolutionOf(70).stage.grade).toBe('3')
    expect(evolutionOf(75).stage.grade).toBe('3.5')
    expect(evolutionOf(79.9).stage.grade).toBe('3.5')
    expect(evolutionOf(80).stage.grade).toBe('4')
  })

  it('ขั้นสุดท้ายคือมนุษย์ฐานข้อมูล (เกรด 4)', () => {
    const e = evolutionOf(100)
    expect(EVO_STAGES).toHaveLength(12)
    expect(EVO_STAGES.filter((s) => s.minor === 0)).toHaveLength(8)
    expect(e).toMatchObject({ index: 11, main: 7, next: null })
    expect(e.stage.name).toBe('มนุษย์ฐานข้อมูล')
  })

  it('เกณฑ์เพิ่มขึ้นทุกขั้น', () => {
    for (let i = 1; i < EVO_STAGES.length; i++) expect(EVO_STAGES[i]!.minScore).toBeGreaterThan(EVO_STAGES[i - 1]!.minScore)
  })
})

describe('ภาพวิวัฒนาการ DB Quest', () => {
  it('ทุกขั้น (รวมขั้นย่อย) มีภาพไม่ซ้ำกัน', async () => {
    const { renderToString } = await import('react-dom/server')
    const { createElement } = await import('react')
    const { EvolutionArt } = await import('./EvolutionArt')
    const html = EVO_STAGES.map((s) => renderToString(createElement(EvolutionArt, { stage: s.art, title: s.name })))
    expect(new Set(html.map((h) => h.replace(/aria-label="[^"]*"/, ''))).size).toBe(EVO_STAGES.length)
  })
})
