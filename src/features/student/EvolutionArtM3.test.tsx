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
    const html = renderToString(<ScoreEvolutionCard score={40} stages={M3_STAGES} art={EvolutionArtM3} pathLabel="ลิงสู่คน" />).replace(/<!-- -->/g, '')
    expect(html).toContain('วานรยืนสองขา')
    expect(html).toContain('มนุษย์ถ้ำ')
  })
})
