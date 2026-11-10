import { readFileSync } from 'node:fs'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseTableConfig } from './assignmentModel'
import { GuidedWorksheet } from './GuidedWorksheet'

// ใบงานกิจกรรม 1.1 (คาบ 2) ใน seed ต้องเป็นแบบไกด์และแสดงผลได้
const sql = readFileSync('supabase/seed.sql', 'utf8')
const raw = /\(2, 'กิจกรรม 1\.1 ไทม์ไลน์เทคโนโลยี',[\s\S]*?'table', 3, 'work',\s*'[^']*',\s*'(\{[^']*\})', 1\)/.exec(sql)?.[1]

describe('ใบงานคาบ 2 แบบไกด์', () => {
  it('config ใน seed อ่านได้ครบ', () => {
    expect(raw).toBeTruthy()
    const config = parseTableConfig(JSON.parse(raw ?? '{}'))
    expect(config.rowLabels).toHaveLength(3)
    expect(config.topic?.choices?.length).toBeGreaterThan(0)
    expect(config.example?.rows).toHaveLength(3)
    const html = renderToString(<GuidedWorksheet config={config} content={{}} locked={false} onChange={() => undefined} />).replace(/<!-- -->/g, '')
    expect(html).toContain('อดีต')
    expect(html).toContain('กรอกแล้ว 0/7 ช่อง')
    expect(html).toContain('ความรู้วิทยาศาสตร์')
  })
})
