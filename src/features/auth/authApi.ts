import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { getDeviceKey } from '@/lib/deviceKey'
import type { LoginErrorCode } from './code'

export const studentProfileSchema = z.object({
  id: z.string(),
  student_code: z.string(),
  prefix: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  nickname: z.string(),
  number: z.number().nullable(),
  avatar: z.string(),
  classroom_id: z.string().nullable(),
  classroom_name: z.string().nullable(),
  // ห้องเรียนบอกวิชา: ม.3 ออกแบบและเทคโนโลยี / ม.5 DB Quest (ฐานข้อมูลเก่าที่ยังไม่มีคอลัมน์นี้ = ม.3)
  course: z.enum(['design_m3', 'dbquest_m5']).default('design_m3'),
})
export type StudentProfile = z.infer<typeof studentProfileSchema>

export type Role = 'admin' | 'student'
export type Course = StudentProfile['course']

const whoamiSchema = z.object({
  role: z.enum(['admin', 'student']).nullable(),
  student: studentProfileSchema.nullable(),
})
export type Identity = z.infer<typeof whoamiSchema>

const loginResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), role: z.enum(['admin', 'student']), student: studentProfileSchema.nullable() }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['not_signed_in', 'rate_limited', 'not_found', 'device_locked']),
    retry_after_sec: z.number().optional(),
  }),
])

export type LoginResult =
  | { ok: true; identity: Identity }
  | { ok: false; error: LoginErrorCode; retryAfterSec?: number }

// หน้าแรกหลังเข้าสู่ระบบ: ครูไปหน้าครู ม.3 (สลับไป DB Quest จากเมนูได้) นักเรียนไปตามวิชาของห้อง
export function homePathFor(identity: Identity): string {
  if (identity.role === 'admin') return '/admin'
  if (identity.role === 'student') return identity.student?.course === 'dbquest_m5' ? '/db/home' : '/home'
  return '/'
}

// ให้เบราว์เซอร์มี auth.uid() แบบ anonymous เสมอ
export async function ensureAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

export async function fetchIdentity(): Promise<Identity> {
  const { data, error } = await supabase.rpc('whoami')
  if (error) throw error
  return whoamiSchema.parse(data)
}

export async function loginWithCode(code: string): Promise<LoginResult> {
  const { data, error } = await supabase.rpc('login_with_code', { p_code: code, p_device_key: getDeviceKey() })
  if (error) return { ok: false, error: 'network' }
  const parsed = loginResultSchema.parse(data)
  if (parsed.ok) return { ok: true, identity: { role: parsed.role, student: parsed.student } }
  return { ok: false, error: parsed.error, retryAfterSec: parsed.retry_after_sec }
}

export async function logoutAndReset(): Promise<void> {
  await supabase.rpc('logout')
  await supabase.auth.signOut()
  await supabase.auth.signInAnonymously()
}
