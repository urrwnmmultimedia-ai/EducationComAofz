import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- สคริปต์ .mjs ไม่มีไฟล์ type
import { checkContentDir, checkFile, findForbiddenKeys } from '../../scripts/check-content.mjs'
import { course } from './course'

describe('ไฟล์เนื้อหาไม่มีเฉลย', () => {
  it('src/content ทั้งโฟลเดอร์ผ่าน', () => {
    expect(checkContentDir(fileURLToPath(new URL('.', import.meta.url)))).toEqual([])
  })

  it('จับคีย์ต้องห้ามได้ทุกระดับ', () => {
    expect(findForbiddenKeys({ q: [{ choices: ['a'], Correct: 1 }], meta: { solution: 'x' } })).toEqual([
      '$.q[0].Correct',
      '$.meta.solution',
    ])
    expect(checkFile('a.md', 'โจทย์\nanswer: B')).toHaveLength(1)
    expect(checkFile('a.md', '{ q: 1, "correct": 2 }')).toHaveLength(1)
    expect(checkFile('a.md', 'คีย์หลัก (Primary Key): คอลัมน์ที่ไม่ซ้ำ')).toEqual([])
  })
})

describe('โครงรายวิชา', () => {
  it('20 คาบ เรียงเลขครบ', () => {
    expect(course.sessions.map((s) => s.no)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('6 ขั้นต่อคาบรวม 120 นาที', () => {
    expect(course.steps.reduce((sum, s) => sum + s.minutes, 0)).toBe(120)
  })

  it('ทุกคาบเนื้อหาอ้างหน่วยที่มีอยู่จริง', () => {
    const units = new Set(course.units.map((u) => u.no))
    for (const s of course.sessions.filter((s) => s.kind === 'lesson')) expect(units.has(s.unit ?? -1)).toBe(true)
  })
})
