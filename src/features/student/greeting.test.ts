import { describe, expect, it } from 'vitest'
import { studentGreeting } from './greeting'

describe('studentGreeting', () => {
  it('รูปแบบครบ', () => {
    expect(studentGreeting({ nickname: 'ต้นกล้า', first_name: 'ธนกร', classroom_name: 'ม.3/1', number: 1 })).toBe(
      'สวัสดี ต้นกล้า ม.3/1 เลขที่ 1',
    )
  })
  it('ไม่มีชื่อเล่นใช้ชื่อจริง และข้ามข้อมูลที่ไม่มี', () => {
    expect(studentGreeting({ nickname: '', first_name: 'ธนกร', classroom_name: null, number: null })).toBe('สวัสดี ธนกร')
  })
})
