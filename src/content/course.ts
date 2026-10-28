import { z } from 'zod'
import raw from './units/course.json'

// โครงรายวิชา DB Quest (ม.5) — ไฟล์เนื้อหาใน src/content มีแค่โจทย์/เนื้อหา ห้ามมีเฉลย
// (เฉลยอยู่ใน Supabase ตาราง answer_keys เท่านั้น ดู scripts/check-content.mjs)

const stepKey = z.enum(['warmup', 'lesson', 'practice', 'game', 'worksheet', 'wrapup'])

const courseSchema = z.object({
  title: z.string(),
  level: z.string(),
  objectives: z.array(z.object({ no: z.number().int(), text: z.string() })),
  units: z.array(z.object({ no: z.number().int(), title: z.string(), icon: z.string(), objectives: z.array(z.number().int()) })),
  sessions: z.array(
    z.object({
      no: z.number().int().min(1).max(20),
      unit: z.number().int().nullable(),
      kind: z.enum(['lesson', 'midterm', 'project', 'final']),
      title: z.string(),
    }),
  ),
  steps: z.array(z.object({ id: stepKey, title: z.string(), minutes: z.number().int().positive() })),
})

export type Course = z.infer<typeof courseSchema>
export type CourseSession = Course['sessions'][number]
export type CourseUnit = Course['units'][number]
export type StepKey = z.infer<typeof stepKey>

export const course: Course = courseSchema.parse(raw)

export function findSession(no: number): CourseSession | undefined {
  return course.sessions.find((s) => s.no === no)
}

export function findUnit(no: number | null): CourseUnit | undefined {
  return no == null ? undefined : course.units.find((u) => u.no === no)
}
