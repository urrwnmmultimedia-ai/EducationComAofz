import { describe, expect, it } from 'vitest'
import { type SubmissionContent, isContentEmpty, isValidHttpUrl, normalizeRows, parseTableConfig, storagePath, validateFile } from './assignmentModel'

describe('table', () => {
  it('config เสียใช้ค่าเริ่มต้น', () => {
    expect(parseTableConfig(null)).toEqual({ columns: ['คำตอบ'], rows: 3 })
  })
  it('normalizeRows เติมช่องว่างและตัดคอลัมน์เกิน', () => {
    expect(normalizeRows([['a', 'b', 'c']], { columns: ['x', 'y'], rows: 2 })).toEqual([
      ['a', 'b'],
      ['', ''],
    ])
  })
})

describe('files', () => {
  it('รับรูปและ PDF ไม่เกิน 10MB', () => {
    expect(validateFile({ name: 'a.png', type: 'image/png', size: 1000 })).toBeNull()
    expect(validateFile({ name: 'a.docx', type: 'application/msword', size: 1000 })).toContain('ไม่รองรับ')
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toContain('10 MB')
  })
  it('path อยู่ในโฟลเดอร์นักเรียน/งาน และไม่ใช้ชื่อไฟล์เดิม', () => {
    const p = storagePath('s1', 'a1', '../ภาพ ต้นแบบ.JPG', 123)
    expect(p.startsWith('s1/a1/123-')).toBe(true)
    expect(p.endsWith('.jpg')).toBe(true)
    expect(p).not.toContain('..')
  })
})

describe('isContentEmpty', () => {
  it.each([
    ['text', { text: '  ' }, 0, true],
    ['text', { text: 'x' }, 0, false],
    ['table', { rows: [['', ' ']] }, 0, true],
    ['table', { rows: [['', 'x']] }, 0, false],
    ['file', {}, 1, false],
    ['link', { url: '' }, 0, true],
  ] as [string, SubmissionContent, number, boolean][])('%s', (type, content, files, expected) => {
    expect(isContentEmpty(type, content, files)).toBe(expected)
  })
})

describe('isValidHttpUrl', () => {
  it('รับเฉพาะ http/https', () => {
    expect(isValidHttpUrl('https://canva.com/x')).toBe(true)
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
  })
})
