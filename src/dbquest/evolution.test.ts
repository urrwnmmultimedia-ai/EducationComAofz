import { describe, expect, it } from 'vitest'
import { EVO_STAGES, evolutionOf } from './evolution'

describe('วิวัฒนาการ DB Quest (8 ขั้น = เกรด 0–4)', () => {
  it('เริ่มที่เจ้าทุยน้อย (เกรด 0) อีก 50 คะแนนถึงขั้นถัดไป', () => {
    const e = evolutionOf(0)
    expect(e.index).toBe(0)
    expect(e.stage.name).toBe('เจ้าทุยน้อย')
    expect(e.stage.grade).toBe('0')
    expect(e.toNext).toBe(50)
  })

  it('ขึ้นขั้นตรงเกณฑ์เกรด 50/55/60/65/70/75/80', () => {
    expect(evolutionOf(49.99).index).toBe(0)
    expect(evolutionOf(50).stage.grade).toBe('1')
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
    expect(EVO_STAGES).toHaveLength(8)
    expect(e.index).toBe(7)
    expect(e.next).toBeNull()
    expect(e.stage.name).toBe('มนุษย์ฐานข้อมูล')
  })

  it('เกณฑ์เพิ่มขึ้นทุกขั้น', () => {
    for (let i = 1; i < EVO_STAGES.length; i++) expect(EVO_STAGES[i]!.minScore).toBeGreaterThan(EVO_STAGES[i - 1]!.minScore)
  })
})
