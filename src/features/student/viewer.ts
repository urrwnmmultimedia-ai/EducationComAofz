import { useAuth } from '@/app/AuthContext'
import type { StudentProfile } from '@/features/auth/authApi'

// ครูเปิดหน้านักเรียน ม.3 (โหมดดูตัวอย่าง): ใช้โปรไฟล์สมมติ id ว่าง — ดึงข้อมูลได้แต่ไม่มีของใครเลย และไม่บันทึกอะไร
export const PREVIEW_STUDENT: StudentProfile = {
  id: '00000000-0000-0000-0000-000000000000',
  student_code: '',
  prefix: '',
  first_name: 'ครู',
  last_name: '',
  nickname: 'ครู (ดูตัวอย่าง)',
  number: null,
  avatar: 'doctor',
  classroom_id: null,
  classroom_name: 'โหมดดูตัวอย่างของครู',
  course: 'design_m3',
}

// นักเรียนที่กำลังดูหน้า: นักเรียนจริง หรือโปรไฟล์สมมติเมื่อครูดูตัวอย่าง
export function useViewer(): { student: StudentProfile | null; isPreview: boolean } {
  const { identity } = useAuth()
  const isPreview = identity.role === 'admin'
  return { student: identity.student ?? (isPreview ? PREVIEW_STUDENT : null), isPreview }
}
