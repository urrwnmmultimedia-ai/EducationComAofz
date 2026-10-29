import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { BookOpen, House, LogOut, Sparkles, Trophy, UserRound } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Avatar } from '@/components/characters/Characters'
import { Button } from '@/components/Button'
import { Backdrop, BottomNav, BrandMark, PreviewBanner, TopBar, TopNav, type NavItem } from '@/components/shell/Shell'
import { useAsync } from '@/lib/useAsync'
import { fetchTotalXp } from './studentApi'
import { useViewer } from './viewer'

// คะแนนรวมอยู่ในหน้า "ฉัน" แล้ว · เกมเล่นจากในคาบเรียน
const NAV: NavItem[] = [
  { to: '/home', label: 'หน้าหลัก', icon: House },
  { to: '/lessons', label: 'บทเรียน', icon: BookOpen },
  { to: '/leaderboard', label: 'อันดับ', icon: Trophy },
  { to: '/profile', label: 'ฉัน · คะแนน', icon: UserRound },
]

export function StudentLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const { student, isPreview: isAdminPreview } = useViewer()
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
          โหมดดูตัวอย่างของครู — เห็นหน้าเหมือนนักเรียน แต่ไม่บันทึกผล (นักเรียนเห็นเฉพาะคาบที่ปลดล็อก){' '}
          <Link to="/admin/sessions" className="font-semibold underline">
            กลับหน้าครู
          </Link>
        </PreviewBanner>
      )}
      <TopBar left={<BrandMark course="m3" to={isAdminPreview ? '/admin' : '/home'} />}>
        <TopNav items={NAV} />
        {student && (
          // ปุ่ม "ฉัน" รวม XP: อวาตาร์ + ชื่อ + เหรียญ XP → หน้าโปรไฟล์และคะแนน
          <Link
            to="/profile"
            className="tq-press group flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-b from-white to-surface py-1 pl-1 pr-1.5 shadow-[inset_0_1px_0_#fff,0_1px_2px_rgb(20_45_100/0.12),0_8px_18px_-10px_rgb(20_45_100/0.5)] ring-1 ring-line hover:-translate-y-px"
            aria-label={`ฉันและคะแนน${xp.data != null ? ` · ${xp.data} XP` : ''}`}
          >
            <Avatar name={student.avatar} className="size-9 rounded-full bg-surface shadow-[inset_0_-2px_4px_rgb(20_45_100/0.15)] ring-2 ring-gold-400" />
            <span className="hidden max-w-28 truncate text-sm font-semibold text-ink xl:block">{student.nickname || student.first_name}</span>
            {xp.data != null && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-b from-gold-300 to-gold-400 px-2.5 py-1 text-xs font-bold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-1px_0_rgb(140_100_0/0.25)] ring-1 ring-gold-500/50">
                <Sparkles className="size-3.5 text-gold-600" aria-hidden />
                {xp.data.toLocaleString('th-TH')} XP
              </span>
            )}
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

      <BottomNav items={NAV} />
    </div>
  )
}
