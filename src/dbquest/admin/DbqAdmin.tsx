import { ClipboardCheck, KeyRound, LayoutDashboard, LockOpen, NotebookTabs, School, Settings, SquarePen, UserCog, Users } from 'lucide-react'
import { AdminClassroomsPage } from '@/features/admin/AdminClassroomsPage'
import { AdminStudentsPage } from '@/features/admin/AdminStudentsPage'
import { DBQ } from '@/features/admin/courseScope'
import { AdminShell } from '@/components/shell/AdminShell'
import type { NavItem } from '@/components/shell/Shell'

const NAV: NavItem[] = [
  { to: '/db/admin', label: 'ภาพรวม', icon: LayoutDashboard, end: true },
  { to: '/db/admin/students', label: 'ความคืบหน้านักเรียน', icon: Users },
  { to: '/db/admin/unlock', label: 'ปลดล็อกคาบ', icon: LockOpen },
  { to: '/db/admin/grading', label: 'ตรวจงาน', icon: ClipboardCheck },
  { to: '/db/admin/exams', label: 'กรอกคะแนนสอบ/อื่น ๆ', icon: SquarePen },
  { to: '/db/admin/gradebook', label: 'สมุดคะแนน', icon: NotebookTabs },
  { to: '/db/admin/answer-keys', label: 'เฉลยทั้งหมด', icon: KeyRound },
  { to: '/db/admin/roster', label: 'รายชื่อนักเรียน', icon: UserCog },
  { to: '/db/admin/classrooms', label: 'ห้องเรียน', icon: School },
  { to: '/db/admin/settings', label: 'ตั้งค่า', icon: Settings },
]

// หน้าครูของ DB Quest — ใช้รหัสครูเดียวกับเว็บ ม.3 สลับวิชาได้จากแถบด้านซ้าย
export function DbqAdminLayout() {
  return <AdminShell course="db" nav={NAV} previewTo="/db/map" title="DB Quest – หน้าครู" />
}

// จัดการรายชื่อ/ห้องของ DB Quest (ใช้หน้าเดียวกับ ม.3 แต่เห็นเฉพาะห้อง ม.5)
export function DbqRosterPage() {
  return <AdminStudentsPage course={DBQ} />
}

export function DbqClassroomsPage() {
  return <AdminClassroomsPage course={DBQ} />
}
