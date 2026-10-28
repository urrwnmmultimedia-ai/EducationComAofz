import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { AppSettingsRow } from '@/lib/database.types'
import { gradeScaleSchema, scoreWeightsSchema, weightsTotal } from '@/lib/scoring'

export const generalSettingsSchema = z.object({
  school_name: z.string().trim().min(1, 'กรุณากรอกชื่อโรงเรียน').max(120),
  term: z.union([z.literal(1), z.literal(2)]),
  year: z.number().int().min(2500, 'ปีการศึกษาเป็น พ.ศ. เช่น 2569').max(2700),
  student_code_length: z.number().int().min(3, 'อย่างน้อย 3 หลัก').max(12, 'ไม่เกิน 12 หลัก'),
  device_lock: z.boolean(),
  leaderboard_mode: z.enum(['all', 'top10', 'hidden']),
})
export type GeneralSettings = z.infer<typeof generalSettingsSchema>

export const scoringSettingsSchema = z
  .object({
    score_weights: scoreWeightsSchema,
    grade_scale: gradeScaleSchema,
    late_penalty_enabled: z.boolean(),
    late_penalty_pct: z.number().min(0, 'หักได้ 0–100%').max(100, 'หักได้ 0–100%'),
    affective_full_xp: z.number().int().min(1, 'XP เต็มต้องมากกว่า 0'),
  })
  .refine((v) => weightsTotal(v.score_weights) === 100, { message: 'สัดส่วนคะแนนต้องรวมได้ 100 พอดี' })
  .refine((v) => v.grade_scale.some((g) => g.min === 0), { message: 'เกณฑ์เกรดต้องมีขั้นที่เริ่มจาก 0 คะแนน' })
export type ScoringSettings = z.infer<typeof scoringSettingsSchema>

export const adminCodeSchema = z
  .string()
  .trim()
  .min(6, 'รหัสครูต้องยาวอย่างน้อย 6 ตัวอักษร')
  .max(64)
  .refine((v) => !/^[0-9]+$/.test(v), 'รหัสครูต้องมีตัวอักษร (ห้ามเป็นตัวเลขล้วน จะชนกับรหัสนักเรียน)')

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettingsRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (err) setError('โหลดการตั้งค่าไม่สำเร็จ')
    else setSettings(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveGeneral = useCallback(async (values: GeneralSettings) => {
    const { data, error: err } = await supabase
      .from('app_settings')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('*')
      .single()
    if (err) throw err
    setSettings(data)
  }, [])

  const saveScoring = useCallback(async (values: ScoringSettings) => {
    const { data, error: err } = await supabase
      .from('app_settings')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('*')
      .single()
    if (err) throw err
    setSettings(data)
  }, [])

  const changeAdminCode = useCallback(async (code: string) => {
    const { error: err } = await supabase.rpc('admin_set_admin_code', { p_new_code: code })
    if (err) throw err
  }, [])

  return { settings, error, saveGeneral, saveScoring, changeAdminCode }
}
