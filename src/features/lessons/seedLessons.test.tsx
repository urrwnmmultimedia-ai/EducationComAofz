import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LessonCards } from './LessonCards'
import { splitCards } from './lessonFormat'

// ตรวจว่าเนื้อหาบทเรียนใน supabase/seed.sql แสดงผลได้ทุกคาบ
const sql = readFileSync('supabase/seed.sql', 'utf8')
const lessons = [...sql.matchAll(/\$md\$([\s\S]*?)\$md\$/g)].map((m) => m[1] ?? '')

describe('seed lessons', () => {
  it('มีเนื้อหาครบ 20 คาบ', () => {
    expect(lessons).toHaveLength(20)
  })

  it.each(lessons.map((md, i) => [i + 1, md] as const))('คาบที่ %d แสดงผลได้', (_no, md) => {
    const cards = splitCards(md, 'บทเรียน')
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.every((c) => c.title.trim().length > 0)).toBe(true)
    const html = renderToString(<LessonCards title="บทเรียน" markdown={md} />).replace(/<!-- -->/g, '')
    expect(html).toContain(`การ์ด 1 / ${cards.length}`)
  })
})
