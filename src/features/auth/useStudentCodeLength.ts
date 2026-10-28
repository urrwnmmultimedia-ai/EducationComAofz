import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const FALLBACK = 5

// อ่านความยาวรหัสนักเรียนจาก app_settings (อ่านได้หลัง sign in แบบ anonymous)
export function useStudentCodeLength(enabled: boolean): number {
  const [length, setLength] = useState(FALLBACK)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void supabase
      .from('app_settings')
      .select('student_code_length')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setLength(data.student_code_length)
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return length
}
