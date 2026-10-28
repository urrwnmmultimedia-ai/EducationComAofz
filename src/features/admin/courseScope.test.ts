import { describe, expect, it } from 'vitest'
import { DBQ, M3, roomsOf, studentsIn } from './courseScope'

const rooms = [
  { id: 'a', course: M3 },
  { id: 'b', course: DBQ },
]
const students = [
  { id: 1, classroom_id: 'a' },
  { id: 2, classroom_id: 'b' },
  { id: 3, classroom_id: null },
]

describe('แยกข้อมูลตามวิชา', () => {
  it('ห้องของแต่ละวิชา', () => {
    expect(roomsOf(rooms, M3).map((r) => r.id)).toEqual(['a'])
    expect(roomsOf(rooms, DBQ).map((r) => r.id)).toEqual(['b'])
  })

  it('นักเรียนในห้องของวิชา (ไม่มีห้อง = ม.3)', () => {
    expect(studentsIn(students, roomsOf(rooms, M3), M3).map((s) => s.id)).toEqual([1, 3])
    expect(studentsIn(students, roomsOf(rooms, DBQ), DBQ).map((s) => s.id)).toEqual([2])
  })
})
