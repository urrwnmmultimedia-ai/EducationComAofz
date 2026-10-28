import { describe, expect, it } from 'vitest'
import { normalizeClassroom, parseStudentTable } from './studentImport'

describe('normalizeClassroom', () => {
  it.each([
    ['1', 'ม.3/1'],
    ['3/2', 'ม.3/2'],
    ['ม. 3/4', 'ม.3/4'],
    ['ม.3/5', 'ม.3/5'],
    ['', ''],
  ])('%s => %s', (input, out) => {
    expect(normalizeClassroom(input)).toBe(out)
  })
})

describe('parseStudentTable', () => {
  it('อ่านหัวตารางภาษาไทยและแปลงข้อมูล', () => {
    const r = parseStudentTable([
      ['รหัส', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ชื่อเล่น', 'ห้อง', 'เลขที่'],
      [10001, 'เด็กชาย', 'ธนกร', 'ใจดี', 'กล้า', '3/1', 1],
      ['', '', '', '', '', '', ''],
      ['10002', 'เด็กหญิง', 'พิม', 'สุข', '', 'ม.3/1', ''],
    ])
    expect(r.issues).toEqual([])
    expect(r.rows).toEqual([
      { student_code: '10001', prefix: 'เด็กชาย', first_name: 'ธนกร', last_name: 'ใจดี', nickname: 'กล้า', classroom: 'ม.3/1', number: 1 },
      { student_code: '10002', prefix: 'เด็กหญิง', first_name: 'พิม', last_name: 'สุข', nickname: '', classroom: 'ม.3/1', number: null },
    ])
  })

  it('สลับลำดับคอลัมน์และหัวภาษาอังกฤษได้', () => {
    const r = parseStudentTable([
      ['first_name', 'student_code'],
      ['A', '12345'],
    ])
    expect(r.rows[0]?.student_code).toBe('12345')
    expect(r.rows[0]?.first_name).toBe('A')
  })

  it('แจ้งคอลัมน์ที่ขาด', () => {
    expect(parseStudentTable([['ชื่อ'], ['A']]).missingColumns).toEqual(['รหัส'])
  })

  it('แจ้งแถวผิดและรหัสซ้ำพร้อมเลขแถว', () => {
    const r = parseStudentTable([
      ['รหัส', 'ชื่อ'],
      ['abc', 'A'],
      ['10001', ''],
      ['10002', 'B'],
      ['10002', 'C'],
    ])
    expect(r.rows).toHaveLength(1)
    expect(r.issues.map((i) => i.line)).toEqual([2, 3, 5])
    expect(r.issues[2]?.message).toContain('ซ้ำ')
  })
})
