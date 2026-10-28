import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { ChartColumn, Gamepad2, House, LogOut, Trophy, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Avatar } from '@/components/characters/Characters'
import { Button } from '@/components/Button'
import { Backdrop, BottomNav, BrandMark, PreviewBanner, TopBar, TopNav, XpPill, type NavItem } from '@/components/shell/Shell'
import { useAsync } from '@/lib/useAsync'
import { fetchTotalXp } from './studentApi'

const NAV: NavItem[] = [
  { to: '/home', label: 'หน้าหลัก', icon: House },
  { to: '/games', label: 'เกม', icon: Gamepad2 },
  { to: '/scores', label: 'คะแนน', icon: ChartColumn },
  { to: '/leaderboard', label: 'อันดับ', icon: Trophy },
  { to: '/profile', label: 'ฉัน', icon: UserRound },
]

export function StudentLayout() {
  const { identity, logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const student = identity.student
  const isAdminPreview = identity.role === 'admin'
  const { pathname } = useLocation()
  const xp = useAsync(() => (student ? fetchTotalXp(student.id) : Promise.resolve(null)), [student?.id])

  const onLogout = async () => {
    setLeaving(true)
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh pb-28 lg:pb-0">
      <Backdrop variant={pathname === '/home' ? 'band' : 'soft'} />
      {isAdminPreview && (
        <PreviewBanner>
          โหมดดูตัวอย่างของครู — นักเรียนจะเห็นเฉพาะคาบที่ปลดล็อก{' '}
          <Link to="/admin/sessions" className="font-semibold underline">
            กลับหน้าครู
          </Link>
        </PreviewBanner>
      )}
      <TopBar left={<BrandMark course="m3" to={isAdminPreview ? '/admin' : '/home'} />}>
        {!isAdminPreview && <TopNav items={NAV} />}
        {xp.data != null && <XpPill xp={xp.data} />}
        {student && (
          <Link
            to="/profile"
            className="tq-press hidden shrink-0 items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-sm ring-1 ring-line xl:flex"
            aria-label="โปรไฟล์ของฉัน"
          >
            <Avatar name={student.avatar} className="size-8 rounded-full bg-surface" />
            <span className="max-w-28 truncate text-sm font-semibold text-ink">{student.nickname || student.first_name}</span>
          </Link>
        )}
        {!isAdminPreview && (
          <Button variant="ghost" className="min-h-11 px-3" onClick={() => void onLogout()} loading={leaving} loadingText="…" aria-label="ออกจากระบบ">
            <LogOut className="size-5" aria-hidden />
            <span className="hidden lg:inline">ออก</span>
          </Button>
        )}
      </TopBar>

      <main className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-6">
        <Outlet />
      </main>

      {!isAdminPreview && <BottomNav items={NAV} />}
    </div>
  )
}
