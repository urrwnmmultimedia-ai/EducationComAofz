import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { NongData } from '@/components/illustrations/NongData'

const NAV = [
  { to: '/db/admin', label: 'ภาพรวม', end: true },
  { to: '/db/admin/students', label: 'นักเรียน', end: false },
  { to: '/db/admin/unlock', label: 'ปลดล็อกคาบ', end: false },
  { to: '/db/admin/grading', label: 'ตรวจงาน', end: false },
  { to: '/db/admin/exams', label: 'กรอกคะแนนสอบ/อื่น ๆ', end: false },
  { to: '/db/admin/gradebook', label: 'สมุดคะแนน', end: false },
  { to: '/db/admin/answer-keys', label: 'เฉลยทั้งหมด', end: false },
  { to: '/db/admin/settings', label: 'ตั้งค่า', end: false },
]

// หน้าครูของ DB Quest — ใช้รหัสครูเดียวกับเว็บ ม.3 สลับไปมาได้จากเมนู
export function DbqAdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  const onLogout = async () => {
    setLeaving(true)
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-dq-50 text-slate-800 md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b border-dq-100 bg-white md:min-h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-3">
          <NongData className="size-9" />
          <p className="flex-1 font-display text-dq-900">ครู · DB Quest ม.5</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-xl px-3 py-2 font-display text-sm ${
                  isActive ? 'bg-dq-600 text-white' : 'text-slate-700 hover:bg-dq-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex gap-2 px-2 py-3 md:flex-col">
          <Link to="/db/map" className="rounded-xl px-3 py-2 font-display text-sm text-dq-700 ring-2 ring-dq-100 hover:bg-dq-100">
            ดูหน้านักเรียน
          </Link>
          <Link to="/admin" className="rounded-xl px-3 py-2 font-display text-sm text-brand-700 ring-2 ring-brand-100 hover:bg-brand-100">
            ไปหน้าครู ม.3
          </Link>
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={leaving}
            className="rounded-xl px-3 py-2 text-left font-display text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            {leaving ? 'กำลังออก…' : 'ออกจากระบบ'}
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

