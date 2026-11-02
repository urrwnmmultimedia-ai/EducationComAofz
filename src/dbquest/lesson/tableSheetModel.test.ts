import { describe, expect, it } from 'vitest'
import { addField, emptySheet, loadSheet, missingParts, parseSheet, pkHasDuplicates, removeField, serializeSheet } from './tableSheetModel'

const cfg = { minFields: 4, maxFields: 8, rows: 3 }

function filled() {
  return {
    ...emptySheet(cfg),
    system: 'ร้านชานม',
    table: 'เมนู',
    fields: ['รหัสเมนู', 'ชื่อเมนู', 'ราคา', 'ขนาด'],
    rows: [
      ['M01', 'ชาไทย', '35', 'M'],
      ['M02', 'ชาเขียว', '40', 'L'],
      ['M03', 'โกโก้', '45', 'M'],
    ],
    pk: 0,
    reason: 'แต่ละเมนูมีรหัสของตัวเอง',
  }
}

describe('table worksheet model', () => {
  it('empty sheet lists every missing part', () => {
    expect(missingParts(emptySheet(cfg), cfg)).toHaveLength(6)
  })

  it('complete sheet can be submitted and round-trips through text', () => {
    const s = filled()
    expect(missingParts(s, cfg)).toEqual([])
    const back = parseSheet(serializeSheet(s))
    expect(back).toEqual(s)
    expect(loadSheet(serializeSheet(s), cfg)).toEqual(s)
  })

  it('plain text answers are not tables', () => {
    expect(parseSheet('ร้านสะดวกซื้อ ...')).toBeNull()
    expect(parseSheet('{bad json')).toBeNull()
    expect(loadSheet('ข้อความเก่า', cfg)).toEqual(emptySheet(cfg))
  })

  it('requires every named field filled in each record', () => {
    const s = filled()
    s.rows[2] = ['M03', '', '45', 'M']
    expect(missingParts(s, cfg)).toEqual(['ข้อมูลระเบียนให้ครบ 3 แถว'])
  })

  it('add/remove field keeps rows and primary key aligned', () => {
    const s = addField(filled())
    expect(s.fields).toHaveLength(5)
    expect(s.rows.every((r) => r.length === 5)).toBe(true)
    const moved = removeField({ ...s, pk: 2 }, 0)
    expect(moved.pk).toBe(1)
    expect(removeField({ ...s, pk: 2 }, 2).pk).toBeNull()
  })

  it('flags duplicate primary key values', () => {
    const s = filled()
    expect(pkHasDuplicates(s)).toBe(false)
    expect(pkHasDuplicates({ ...s, pk: 3 })).toBe(true)
  })
})
