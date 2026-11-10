import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { gameComponent } from './registry'
import { parseGameConfig } from './shared/schemas'
import type { Sfx } from './shared/sfx'

const noop = () => undefined
const sfx: Sfx = { enabled: false, toggle: noop, correct: noop, wrong: noop, tick: noop, win: noop }
const games = JSON.parse(readFileSync('supabase/games/games.json', 'utf8')) as { slug: string; title: string; config: unknown }[]

// เปิดหน้าเล่นของทุกเกมใน seed ได้โดยไม่ error
describe('render every seeded game', () => {
  it.each(games.map((g) => [g.slug, g.config] as const))('%s', (_slug, raw) => {
    const r = parseGameConfig(raw)
    if (!r.ok) throw new Error(r.error)
    const Game = gameComponent(r.config)
    const html = renderToString(<Game config={r.config} onFinish={noop} sfx={sfx} />)
    expect(html.length).toBeGreaterThan(100)
  })
})

// เกมในคาบแบบใหม่: เริ่มนับถอยหลังทันที ไม่มีปุ่ม "เริ่มเล่น"
describe('GameShell autoStart', () => {
  it('ข้ามหน้าคำอธิบาย', async () => {
    const { MemoryRouter } = await import('react-router')
    const { GameShell } = await import('./shared/GameShell')
    const g = games.find((x) => x.slug === '5g-time-machine')
    const r = parseGameConfig(g?.config)
    if (!r.ok) throw new Error(r.error)
    const props = { title: 'เกม', description: '', config: r.config, Game: gameComponent(r.config), onSubmit: async () => ({ xp: 0, first_play: false, plays_today: 0, daily_limit: 3, capped: false, best_score: 0, new_badges: [] }), backTo: '/' }
    const auto = renderToString(<MemoryRouter><GameShell {...props} embedded autoStart /></MemoryRouter>)
    const normal = renderToString(<MemoryRouter><GameShell {...props} embedded /></MemoryRouter>)
    expect(auto).not.toContain('เริ่มเล่น')
    expect(auto).toContain('3')
    expect(normal).toContain('เริ่มเล่น')
  })
})
