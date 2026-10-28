import { describe, expect, it } from 'vitest'
import { checkCodeFormat, loginErrorMessage, sanitizeStudentInput } from './code'

describe('checkCodeFormat', () => {
  it('รับรหัสนักเรียนตัวเลขครบหลัก', () => {
    expect(checkCodeFormat(' 10001 ', 'student', 5)).toEqual({ ok: true, value: '10001' })
  })
  it('ปฏิเสธรหัสว่าง', () => {
    expect(checkCodeFormat('  ', 'student', 5).ok).toBe(false)
  })
  it('ปฏิเสธตัวอักษรในโหมดนักเรียน', () => {
    expect(checkCodeFormat('1000a', 'student', 5)).toEqual({ ok: false, message: 'รหัสนักเรียนต้องเป็นตัวเลขเท่านั้น' })
  })
  it('ปฏิเสธความยาวไม่ตรง', () => {
    expect(checkCodeFormat('1234', 'student', 5)).toEqual({ ok: false, message: 'รหัสนักเรียนต้องมี 5 หลัก' })
  })
  it('โหมดครูรับตัวอักษร', () => {
    expect(checkCodeFormat('anything', 'admin', 5).ok).toBe(true)
  })
})

describe('sanitizeStudentInput', () => {
  it('ตัดอักขระที่ไม่ใช่ตัวเลขและจำกัดความยาว', () => {
    expect(sanitizeStudentInput('1a2b3456789', 5)).toBe('12345')
  })
})

describe('loginErrorMessage', () => {
  it('ข้อความรหัสไม่พบตามที่กำหนด', () => {
    expect(loginErrorMessage('not_found')).toBe('ไม่พบรหัสนักเรียนนี้ กรุณาติดต่อครู')
  })
  it('คำนวณนาทีที่ต้องรอ', () => {
    expect(loginErrorMessage('rate_limited', 61)).toContain('2 นาที')
  })
})
