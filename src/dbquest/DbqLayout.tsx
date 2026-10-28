import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { NongData } from '@/components/illustrations/NongData'
import { useTheme } from './useTheme'

const NAV = [
  { to: '/db/home', label: 'หน้าหลัก', icon: '🏠' },
  { to: '/db/map', label: 'แผนที่', icon: '🗺️' },
  { to: '/db/sql', label: 'ฝึก SQL', icon: '⌨️' },
  { to: '/db/glossary', label: 'ศัพท์', icon: '📖' },
  { to: '/db/assignments', label: 'งาน', icon: '📝' },
  { to: '/db/me', label: 'ฉัน', icon: '🙂' },
]

// กรอบหน้าของ DB Quest (ม.5): ธีมน้ำเงิน-ฟ้า โหมดมืดได้ ตัวอักษรเนื้อหา 18px
export function DbqLayout() {
  const { identity, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [leaving, setLeaving] = useState(false)
  const student = identity.student
  const isAdminPreview = identity.role === 'admin'

  useEffect(() => {
    const prev = document.title
    document.title = 'DB Quest – เรียนฐานข้อมูลด้วยตัวเอง'
    return () => {
      document.title = prev
    }
  }, [])

  const onLogout = async () => {
    setLeaving(true)
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-dvh bg-dq-50 pb-20 text-lg text-slate-800 dark:bg-dq-950 dark:text-dq-50 md:pb-0`}>
      {isAdminPreview && (
        <div className="bg-xp-300 px-4 py-2 text-center text-base text-orange-950">
          โหมดดูตัวอย่างของครู{' '}
          <Link to="/db/admin" className="font-display underline">
            กลับหน้าครู DB Quest
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-dq-100 bg-white/90 backdrop-blur dark:border-dq-800 dark:bg-dq-950/90">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
          <Link to={isAdminPreview ? '/db/admin' : '/db/home'} className="flex min-w-0 flex-1 items-center gap-2">
            <NongData className="size-10 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-dq-800 dark:text-dq-100">DB Quest</span>
              <span className="block truncate text-sm text-slate-500 dark:text-dq-300">
                {isAdminPreview ? 'ครู' : (student?.nickname || student?.first_name) ?? ''}
                {student?.classroom_name && ` · ${student.classroom_name}`}
              </span>
            </span>
          </Link>
          <nav className="hidden gap-1 md:flex" aria-label="เมนูหลัก">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-1.5 font-display text-base ${
                    isActive ? 'bg-dq-600 text-white' : 'text-slate-600 hover:bg-dq-100 dark:text-dq-200 dark:hover:bg-dq-900'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl hover:bg-dq-100 dark:hover:bg-dq-900"
            aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
          >
            <span aria-hidden>{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          {!isAdminPreview && (
            <button
              type="button"
              onClick={() => void onLogout()}
              disabled={leaving}
              className="min-h-11 shrink-0 rounded-2xl px-3 font-display text-base text-dq-700 hover:bg-dq-100 disabled:opacity-60 dark:text-dq-200 dark:hover:bg-dq-900"
            >
              {leaving ? 'กำลังออก…' : 'ออก'}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-dq-100 bg-white dark:border-dq-800 dark:bg-dq-950 md:hidden"
        aria-label="เมนูหลัก"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${isActive ? 'text-dq-700 dark:text-dq-200' : 'text-slate-500 dark:text-dq-400'}`
            }
          >
            <span className="text-xl" aria-hidden>
              {n.icon}
            </span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
