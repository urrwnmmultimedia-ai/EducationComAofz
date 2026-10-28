// ตัวตนของเว็บ — แก้ชื่อ/ตราโรงเรียนที่ไฟล์นี้ไฟล์เดียว
export const BRAND = {
  name: 'TechQuest',
  school: {
    short: 'URRWNM',
    logo: '/brand/school-logo.png',
  },
} as const

export type CourseKey = 'm3' | 'db'

export const COURSES: Record<CourseKey, { name: string; subject: string }> = {
  m3: { name: 'ห้องเรียนเทคโนโลยี ม.3', subject: 'การออกแบบและเทคโนโลยี' },
  db: { name: 'DB Quest', subject: 'ฐานข้อมูล ม.5' },
}
