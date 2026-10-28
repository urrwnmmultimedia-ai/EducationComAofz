import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { BookOpen, BookText, ClipboardList, House, LogOut, Moon, SquareTerminal, Sun, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Backdrop, BottomNav, BrandMark, PreviewBanner, TopBar, TopNav, XpPill, type NavItem } from '@/components/shell/Shell'
import { useAsync } from '@/lib/useAsync'
import { fetchMe } from './pages/dbqStudentApi'
import { useTheme } from './useTheme'

const NAV: NavItem[] = [
  { to: '/db/home', label: 'หน้าหลัก', icon: House },
  { to: '/db/map', label: 'บทเรียน', icon: BookOpen },
  { to: '/db/sql', label: 'ฝึก SQL', icon: SquareTerminal, locked: true },
  { to: '/db/glossary', label: 'ศัพท์', icon: BookText, locked: true },
  { to: '/db/assignments', label: 'งาน', icon: ClipboardList },
  { to: '/db/me', label: 'ฉัน', icon: UserRound },
]

// กรอบหน้าของ DB Quest (ม.5) ใต้แบรนด์ TechQuest — โหมดมืดได้ ตัวอักษรเนื้อหา 18px
export function DbqLayout() {
  const { identity, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [leaving, setLeaving] = useState(false)
  const student = identity.student
  const isAdminPreview = identity.role === 'admin'
  const { pathname } = useLocation()
  const me = useAsync(() => (student ? fetchMe() : Promise.resolve(null)), [student?.id])

  useEffect(() => {
    const prev = document.title
    document.title = 'DB Quest · TechQuest'
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
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-dvh pb-28 lg:pb-0 text-lg text-ink dark:text-dq-50`}>
      <Backdrop variant={pathname === '/db/home' ? 'band' : 'soft'} />
      {isAdminPreview && (
        <PreviewBanner>
          โหมดดูตัวอย่างของครู{' '}
          <Link to="/db/admin" className="font-semibold underline">
            กลับหน้าครู DB Quest
          </Link>
        </PreviewBanner>
      )}
      <TopBar left={<BrandMark course="db" to={isAdminPreview ? '/db/admin' : '/db/home'} />}>
        <TopNav items={NAV} />
        {me.data && <XpPill xp={me.data.xp} />}
        <button
          type="button"
          onClick={toggle}
          className="tq-press grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70 dark:text-dq-200 dark:hover:bg-dq-900"
          aria-label={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
        >
          {theme === 'dark' ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
        </button>
        {!isAdminPreview && (
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={leaving}
            className="tq-press grid size-11 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70 disabled:opacity-50 dark:text-dq-200 dark:hover:bg-dq-900"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        )}
      </TopBar>

      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-6">
        <Outlet />
      </main>

      <BottomNav items={NAV} />
    </div>
  )
}
