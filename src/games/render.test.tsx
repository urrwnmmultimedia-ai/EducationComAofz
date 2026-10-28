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
