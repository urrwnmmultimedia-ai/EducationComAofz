import type { ClassroomRow, CourseKey } from '@/lib/database.types'

// แยกข้อมูลตามวิชา: หน้าครู ม.3 (/admin) เห็นเฉพาะห้องวิชา ม.3 · หน้าครู DB Quest (/db/admin) เห็นเฉพาะห้อง ม.5
// นักเรียนที่ยังไม่มีห้องนับเป็นของ ม.3 (วิชาเริ่มต้นของระบบ) เพื่อให้ครูยังเห็นและจัดห้องให้ได้

export const M3: CourseKey = 'design_m3'
export const DBQ: CourseKey = 'dbquest_m5'

export const COURSE_GRADE: Record<CourseKey, number> = { design_m3: 3, dbquest_m5: 5 }
export const COURSE_LABEL: Record<CourseKey, string> = { design_m3: 'ม.3', dbquest_m5: 'DB Quest ม.5' }

export function roomsOf<T extends Pick<ClassroomRow, 'course'>>(rooms: T[], course: CourseKey): T[] {
  return rooms.filter((r) => r.course === course)
}

export function studentsIn<S extends { classroom_id: string | null }>(students: S[], rooms: { id: string }[], course: CourseKey): S[] {
  const ids = new Set(rooms.map((r) => r.id))
  return students.filter((s) => (s.classroom_id ? ids.has(s.classroom_id) : course === M3))
}
