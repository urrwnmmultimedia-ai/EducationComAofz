import { describe, expect, it } from 'vitest'
import { EVO_STAGES, evolutionOf } from './evolution'

describe('วิวัฒนาการ DB Quest (ตามคะแนน 0–100)', () => {
  it('เริ่มที่เจ้าทุยน้อย', () => {
    const e = evolutionOf(0)
    expect(e.index).toBe(0)
    expect(e.stage.name).toBe('เจ้าทุยน้อย')
    expect(e.toNext).toBe(15)
  })

  it('ขึ้นขั้นตามเกณฑ์คะแนน', () => {
    expect(evolutionOf(14.5).index).toBe(0)
    expect(evolutionOf(15).index).toBe(1)
    expect(evolutionOf(49).index).toBe(2)
    expect(evolutionOf(70).index).toBe(4)
  })

  it('ขั้นสุดท้ายคือมนุษย์ฐานข้อมูล', () => {
    const e = evolutionOf(100)
    expect(e.index).toBe(EVO_STAGES.length - 1)
    expect(e.next).toBeNull()
    expect(e.stage.name).toBe('มนุษย์ฐานข้อมูล')
  })

  it('เกณฑ์เพิ่มขึ้นทุกขั้น', () => {
    for (let i = 1; i < EVO_STAGES.length; i++) expect(EVO_STAGES[i]!.minScore).toBeGreaterThan(EVO_STAGES[i - 1]!.minScore)
  })
})
