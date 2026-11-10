import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { sessionContentSchema } from '@/content/lesson'
import { BlockView } from './Blocks'
import { composeGuide, FREE_SLOT, savedSlots } from './warmupGuide'
import { QuizRunner } from './QuizRunner'
import { emptySheet, loadSheet, missingParts, pageMissing, serializeSheet, sheetPages } from './tableSheetModel'
import { WorksheetWizard } from './WorksheetWizard'
import { DBQ_WIDGETS, drillStars, pkProblems, RecapBoard, runQuery, searchSteps } from './widgets'

const s02 = sessionContentSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL('../../content/units/s02.json', import.meta.url)), 'utf8')),
)

describe('คาบ 2 DB Quest แบบใหม่', () => {
  it('มีช่องไกด์ทั้งคำถามก่อนเรียนและคำถามชวนคิดทุกข้อ', () => {
    expect(s02.intro?.guide?.length).toBeGreaterThanOrEqual(2)
    expect(s02.warmupGuide?.length).toBe(s02.warmup.length)
    for (const g of s02.warmupGuide ?? []) expect(g.length).toBeGreaterThanOrEqual(2)
  })

  it('ทุกการ์ดมีภารกิจ ไอคอน และสื่อโต้ตอบ', () => {
    for (const c of s02.cards) {
      expect(c.goal, c.id).toBeTruthy()
      expect(c.icon, c.id).toBeTruthy()
      expect(c.blocks.some((b) => b.kind === 'widget' || b.kind === 'flow'), c.id).toBe(true)
    }
  })

  it('ชื่อ widget ทุกตัวมีอยู่จริง และทุกบล็อกเรนเดอร์ได้', () => {
    for (const c of s02.cards)
      for (const b of c.blocks) {
        if (b.kind === 'widget') expect(DBQ_WIDGETS[b.name], b.name).toBeDefined()
        expect(renderToString(<BlockView block={b} />).length).toBeGreaterThan(0)
      }
  })
})

describe('ขั้นฝึกปฏิบัติแบบด่าน คาบ 2', () => {
  it('มีด่านครบทุกข้อ และตัวช่วยทุกตัวมีอยู่จริง', () => {
    expect(s02.practiceLevels?.length).toBe(s02.practice.length)
    for (const lv of s02.practiceLevels ?? []) if (lv.widget) expect(DBQ_WIDGETS[lv.widget], lv.widget).toBeDefined()
  })

  it('เกมซ้อมเพิ่ม: กลุ่มถูกต้อง มีครบทุกกลุ่ม และไม่ใช้ข้อเดียวกับคำถามที่คิดคะแนน', () => {
    const graded = JSON.stringify(s02.practice)
    const drills = (s02.practiceBonus ?? []).filter((b) => b.kind === 'drill')
    expect(drills.length).toBeGreaterThan(0)
    for (const d of drills) {
      expect(new Set(d.items.map((x) => x.group)).size).toBe(d.groups.length)
      for (const x of d.items) {
        expect(x.group).toBeLessThan(d.groups.length)
        expect(graded.includes(x.text), x.text).toBe(false)
      }
      expect(renderToString(<BlockView block={d} />)).toContain('เริ่มเลย')
    }
  })

  it('ตัวช่วยและแผนที่ด่านเรนเดอร์ได้', () => {
    for (const name of ['pk-rules', 'records-grid']) {
      const W = DBQ_WIDGETS[name]!
      expect(renderToString(<W />).length).toBeGreaterThan(0)
    }
    const html = renderToString(
      <QuizRunner questions={s02.practice} solved={new Set()} attempted={new Set()} onChecked={() => {}} levels={s02.practiceLevels} />,
    )
    expect(html).toContain('แผนที่ด่าน')
    expect(html).toContain(s02.practiceLevels![0]!.title)
  })

  it('ดาวเกมซ้อม: 90% = 3 ดาว, 70% = 2, 50% = 1', () => {
    expect([drillStars(9, 10), drillStars(7, 10), drillStars(5, 10), drillStars(4, 10)]).toEqual([3, 2, 1, 0])
  })
})

describe('สื่อโต้ตอบ', () => {
  it('แข่งค้นหา: สมุดดูครึ่งเล่ม รายชื่อเรียงแล้วตัดครึ่ง', () => {
    expect(searchSteps(500)).toEqual({ notebook: 250, phone: 9 })
    expect(searchSteps(1000).phone).toBe(10)
  })

  it('ทดสอบคีย์หลัก: หาแถวซ้ำและแถวว่าง', () => {
    expect(pkProblems(['B101', 'B102', 'B103'])).toEqual({ dup: [], empty: [], ok: true })
    expect(pkProblems(['ก', 'ก', 'ข'])).toMatchObject({ dup: [0, 1], ok: false })
    expect(pkProblems(['ครูเอ', '', 'ป้าแดง'])).toMatchObject({ dup: [], empty: [1], ok: false })
  })

  it('สืบค้น: ไม่มีเงื่อนไข = ทุกแถว มีเงื่อนไข = เฉพาะที่ตรง', () => {
    expect(runQuery('nickname', null)).toHaveLength(6)
    expect(runQuery('nickname', 'มิว').map((r) => r.name)).toEqual(['ณิชา', 'พิมพ์ชนก', 'ปาย'])
    expect(runQuery('room', 'ม.5/2')).toHaveLength(2)
  })
})

describe('ช่องไกด์เปิดคาบ', () => {
  const slots = [{ label: 'A' }, { label: 'B' }]
  it('รวมคำตอบเป็นบรรทัด "ป้าย: คำตอบ" ข้ามช่องว่าง', () => {
    expect(composeGuide(slots, ['x', ' '])).toBe('A: x')
    expect(composeGuide(slots, ['x', 'y'])).toBe('A: x\nB: y')
    expect(composeGuide([FREE_SLOT], ['คิดว่า…'])).toBe('คิดว่า…')
  })
  it('ดึงคำตอบเดิมกลับตามรูปช่อง ข้อมูลเสียได้ช่องว่าง', () => {
    expect(savedSlots({ slots: [['a', 'b'], ['c']] }, [2, 2])).toEqual([['a', 'b'], ['c', '']])
    expect(savedSlots({ guess: 'old' }, [2])).toEqual([['', '']])
    expect(savedSlots(undefined, [1, 1])).toEqual([[''], ['']])
    expect(savedSlots({ slots: [[1, null]] }, [2])).toEqual([['', '']])
  })
})

describe('ใบงานคาบ 2 แบบทีละหน้า', () => {
  const cfg = s02.worksheet!.table!
  it('ใบงานครอบคลุมทุกเรื่องของคาบ (ฐานข้อมูล เขตข้อมูล ระเบียน คีย์หลัก สืบค้น)', () => {
    expect(cfg.why && cfg.query).toBe(true)
    expect(sheetPages(cfg).map((p) => p.id)).toEqual(['system', 'fields', 'records', 'pk', 'query'])
  })

  it('แต่ละหน้ารู้ว่าตัวเองยังขาดอะไร และทุกส่วนที่ขาดอยู่ในหน้าใดหน้าหนึ่ง', () => {
    const empty = emptySheet(cfg)
    const all = missingParts(empty, cfg)
    const pages = sheetPages(cfg)
    expect(pages.flatMap((p) => pageMissing(empty, cfg, p)).sort()).toEqual([...all].sort())
    const filled = { ...empty, system: 'ร้านชานม', why: 'ข้อมูลเยอะ' }
    expect(pageMissing(filled, cfg, pages[0]!)).toEqual([])
    expect(pageMissing(filled, cfg, pages[4]!)).toEqual(['คำถามสืบค้น (Query)', 'คำตอบของคำถามสืบค้น'])
  })

  it('ส่งแล้วโหลดกลับได้ครบรวมส่วนใหม่ ฉบับเก่าที่ไม่มีส่วนใหม่ยังเปิดได้', () => {
    const s = { ...emptySheet(cfg), why: 'เร็ว', query: 'ใครแต้มครบ', queryResult: 'แพรว' }
    expect(loadSheet(serializeSheet(s), cfg)).toMatchObject({ why: 'เร็ว', query: 'ใครแต้มครบ', queryResult: 'แพรว' })
    const old = JSON.stringify({ kind: 'table', system: 'x', table: 't', fields: ['a'], rows: [['1']], pk: 0, reason: 'r' })
    expect(loadSheet(old, cfg)).toMatchObject({ why: '', query: '', queryResult: '' })
  })

  it('หน้าใบงานเรนเดอร์ได้ (เริ่มที่หน้าแรกที่ยังไม่ครบ)', () => {
    const html = renderToString(<WorksheetWizard sheet={emptySheet(cfg)} cfg={cfg} disabled={false} onChange={() => {}} submit={null} />).replace(/<!-- -->/g, "")
    expect(html).toContain('หน้า 1/6')
    expect(html).toContain('ทำไมต้องใช้ฐานข้อมูล')
  })
})

describe('ปิดคาบ คาบ 2 แบบใหม่', () => {
  it('มีผังสรุปครบทุกคำสำคัญ คำอธิบายคำถามก่อนเรียน และด่านครบทุกข้อภารกิจ', () => {
    expect(s02.recap?.items.map((i) => i.term.split(' ')[0])).toEqual(['ฐานข้อมูล', 'ตาราง', 'ระเบียน', 'เขตข้อมูล', 'คีย์หลัก', 'การสืบค้น'])
    expect(s02.intro?.recap).toBeTruthy()
    expect(s02.closing?.levels?.length).toBe(s02.closing?.questions.length)
  })

  it('ผังสรุปเรนเดอร์ได้ พร้อมตารางไฮไลต์', () => {
    const html = renderToString(<RecapBoard items={s02.recap!.items} withTable />)
    expect(html).toContain('ฐานข้อมูลโรงเรียน')
    expect(html).toContain('เล่นสรุปอัตโนมัติ')
  })
})
