import {
  BookOpen,
  ClipboardCheck,
  FileQuestion,
  Gamepad2,
  LayoutDashboard,
  NotebookTabs,
  School,
  Settings,
  SquarePen,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { AdminShell } from '@/components/shell/AdminShell'
import type { NavItem } from '@/components/shell/Shell'

const NAV: NavItem[] = [
  { to: '/admin', label: 'แดชบอร์ด', icon: LayoutDashboard, end: true },
  { to: '/admin/sessions', label: 'บทเรียน / คาบเรียน', icon: BookOpen },
  { to: '/admin/attendance', label: 'เช็คชื่อ', icon: UserCheck },
  { to: '/admin/assignments', label: 'งาน / ตรวจงาน', icon: ClipboardCheck },
  { to: '/admin/exams', label: 'ชุดสอบ / ผลสอบ', icon: SquarePen },
  { to: '/admin/questions', label: 'คลังข้อสอบ', icon: FileQuestion },
  { to: '/admin/games', label: 'เกม', icon: Gamepad2 },
  { to: '/admin/gradebook', label: 'สมุดคะแนน', icon: NotebookTabs },
  { to: '/admin/progress', label: 'ความคืบหน้านักเรียน', icon: Users },
  { to: '/admin/students', label: 'รายชื่อนักเรียน', icon: UserCog },
  { to: '/admin/classrooms', label: 'ห้องเรียน', icon: School },
  { to: '/admin/settings', label: 'ตั้งค่า', icon: Settings },
]

export function AdminLayout() {
  return <AdminShell course="m3" nav={NAV} previewTo="/home" title="หน้าครู ม.3 · TechQuest" />
}
