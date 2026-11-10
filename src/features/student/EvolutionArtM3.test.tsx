import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EvolutionArtM3 } from './EvolutionArtM3'
import { ScoreEvolutionCard } from '@/components/evolution/ScoreEvolutionCard'
import { M3_STAGES } from './evolutionM3'

describe('EvolutionArtM3', () => {
  it.each(M3_STAGES.map((s, i) => [i, s.name] as const))('draws stage %i (%s)', (i, name) => {
    const html = renderToString(<EvolutionArtM3 stage={i} title={name} />)
    expect(html).toContain('<svg')
    expect(html).toContain(name)
  })

  it('card shows current stage and next target', () => {
    const html = renderToString(<ScoreEvolutionCard score={57} stages={M3_STAGES} art={EvolutionArtM3} pathLabel="ลิงสู่คน" />).replace(/<!-- -->/g, '')
    expect(html).toContain('วานรยืนสองขา')
    expect(html).toContain('มนุษย์ถ้ำ')
  })
})

describe('วิวัฒนาการย่อยในการ์ด', () => {
  it('ช่วง 0–49 แสดงชื่อขั้นย่อยและป้าย "ย่อย"', () => {
    const html = renderToString(<ScoreEvolutionCard score={23} stages={M3_STAGES} art={EvolutionArtM3} pathLabel="ลิงสู่คน" />).replace(/<!-- -->/g, '')
    expect(html).toContain('ลิงน้อยตาเป็นประกาย')
    expect(html).toContain('ขั้น 1/8 · ย่อย 2')
    expect(html).toContain('ลิงน้อยถือกิ่งไม้')
  })
})

describe('ภาพวิวัฒนาการ ม.3', () => {
  it('ทุกขั้น (รวมขั้นย่อย) มีภาพไม่ซ้ำกัน', () => {
    const html = M3_STAGES.map((s) => renderToString(<EvolutionArtM3 stage={s.art} />).replace(/id="[^"]*"|url\(#[^)]*\)/g, ''))
    expect(new Set(html).size).toBe(M3_STAGES.length)
  })
})

describe('เกรดในการ์ดตรงกับสมุดคะแนน', () => {
  const card = (score: number, gradeScale?: { min: number; grade: number }[]) =>
    renderToString(<ScoreEvolutionCard score={score} gradeScale={gradeScale} stages={M3_STAGES} art={EvolutionArtM3} pathLabel="ลิงสู่คน" />).replace(/<!-- -->/g, '')
  it('ใช้คะแนนรวมตามที่ส่งมา และเกณฑ์มาตรฐาน', () => {
    expect(card(4.5)).toContain('เกรด 0')
    expect(card(4.5)).toContain('4.5</span>/100')
    expect(card(72)).toContain('เกรด 3 · ดี')
  })
  it('ใช้เกณฑ์เกรดของครูเมื่อครูตั้งเอง', () => {
    const scale = [{ min: 70, grade: 4 }, { min: 50, grade: 2 }, { min: 0, grade: 0 }]
    expect(card(72, scale)).toContain('เกรด 4')
  })
})
