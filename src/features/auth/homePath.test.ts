import { describe, expect, it } from 'vitest'
import { homePathFor, studentProfileSchema } from './authApi'

const student = (course?: string) =>
  studentProfileSchema.parse({
    id: 's1',
    student_code: '55555',
    prefix: '',
    first_name: 'ทดลอง',
    last_name: '',
    nickname: '',
    number: 1,
    avatar: 'non',
    classroom_id: null,
    classroom_name: null,
    ...(course ? { course } : {}),
  })

describe('homePathFor', () => {
  it('แยกเส้นทางตามวิชาของห้อง', () => {
    expect(homePathFor({ role: 'student', student: student('dbquest_m5') })).toBe('/db/home')
    expect(homePathFor({ role: 'student', student: student('design_m3') })).toBe('/home')
    expect(homePathFor({ role: 'admin', student: null })).toBe('/admin')
    expect(homePathFor({ role: null, student: null })).toBe('/')
  })

  it('ฐานข้อมูลเก่าที่ยังไม่มี course ถือเป็น ม.3', () => {
    expect(student().course).toBe('design_m3')
  })
})
