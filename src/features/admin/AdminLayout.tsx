import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button } from '@/components/Button'
import { Doctor } from '@/components/characters/Characters'

const NAV = [
  { to: '/admin', label: 'แดชบอร์ด', end: true },
  { to: '/admin/sessions', label: 'บทเรียน / คาบเรียน', end: false },
  { to: '/admin/attendance', label: 'เช็คชื่อ', end: false },
  { to: '/admin/assignments', label: 'งาน / ตรวจงาน', end: false },
  { to: '/admin/exams', label: 'ชุดสอบ / ผลสอบ', end: false },
  { to: '/admin/questions', label: 'คลังข้อสอบ', end: false },
  { to: '/admin/games', label: 'เกม', end: false },
  { to: '/admin/gradebook', label: 'สมุดคะแนน', end: false },
  { to: '/admin/students', label: 'นักเรียน', end: false },
  { to: '/admin/classrooms', label: 'ห้องเรียน', end: false },
  { to: '/admin/settings', label: 'ตั้งค่า', end: false },
]

export function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  const onLogout = async () => {
    setLeaving(true)
    await logout()
    navigate('/', { replace: true })
  }

  const logoutButton = (variant: 'secondary' | 'ghost', className = '') => (
    <Button variant={variant} className={className} onClick={() => void onLogout()} loading={leaving} loadingText="กำลังออก…">
      ออกจากระบบ
    </Button>
  )

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-brand-100 bg-white md:min-h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-3">
          <Doctor className="size-9" />
          <p className="flex-1 font-display text-brand-900">หน้าครู</p>
          <div className="md:hidden">{logoutButton('ghost')}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-xl px-3 py-2 font-display text-sm ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-brand-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-2 py-4 md:block">{logoutButton('secondary', 'w-full')}</div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
