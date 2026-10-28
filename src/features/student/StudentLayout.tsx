import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Avatar } from '@/components/characters/Characters'
import { Button } from '@/components/Button'

const NAV = [
  { to: '/home', label: 'หน้าหลัก', icon: '🏠' },
  { to: '/games', label: 'เกม', icon: '🎮' },
  { to: '/scores', label: 'คะแนน', icon: '📊' },
  { to: '/leaderboard', label: 'อันดับ', icon: '🏆' },
  { to: '/profile', label: 'ฉัน', icon: '🙂' },
]

export function StudentLayout() {
  const { identity, logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const student = identity.student
  const isAdminPreview = identity.role === 'admin'

  const onLogout = async () => {
    setLeaving(true)
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      {isAdminPreview && (
        <div className="bg-sun-300 px-4 py-2 text-center text-sm text-amber-950">
          โหมดดูตัวอย่างของครู — นักเรียนจะเห็นเฉพาะคาบที่ปลดล็อก{' '}
          <Link to="/admin/sessions" className="font-display underline">
            กลับหน้าครู
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <Link to={isAdminPreview ? '/admin' : '/home'} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={student?.avatar ?? 'doctor'} className="size-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-brand-900">
                {isAdminPreview ? 'ครู' : student?.nickname || student?.first_name}
              </span>
              {student && (
                <span className="block truncate text-xs text-slate-500">
                  {student.classroom_name ?? 'ยังไม่ระบุห้อง'}
                  {student.number != null && ` · เลขที่ ${student.number}`}
                </span>
              )}
            </span>
          </Link>
          {!isAdminPreview && (
            <nav className="hidden gap-1 sm:flex">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `rounded-xl px-3 py-1.5 font-display text-sm ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-brand-100'}`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          {!isAdminPreview && (
            <Button variant="ghost" onClick={() => void onLogout()} loading={leaving} loadingText="กำลังออก…">
              ออกจากระบบ
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      {!isAdminPreview && (
        <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-brand-100 bg-white sm:hidden" aria-label="เมนูหลัก">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-brand-700' : 'text-slate-500'}`
              }
            >
              <span className="text-lg" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
