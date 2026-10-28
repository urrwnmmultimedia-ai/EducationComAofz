import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Eye, LogOut } from 'lucide-react'
import { BRAND, COURSES, type CourseKey } from '@/app/brand'
import { useAuth } from '@/app/AuthContext'
import { Backdrop, CrestMedallion, type NavItem } from './Shell'

// กรอบหน้าครูที่ใช้ร่วมกันทั้งสองวิชา: แบรนด์ · สลับวิชา · เมนู · ดูหน้านักเรียน · ออก
export function AdminShell({ course, nav, previewTo, title }: { course: CourseKey; nav: NavItem[]; previewTo: string; title: string }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])

  const onLogout = async () => {
    setLeaving(true)
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <Backdrop variant="faint" />
      <aside className="border-b border-line bg-gradient-to-b from-white to-surface/60 shadow-[8px_0_30px_-22px_rgb(20_45_100/0.45)] md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <CrestMedallion className="size-10" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-bold tracking-tight text-ink">{BRAND.name}</p>
            <p className="text-xs text-ink-2">หน้าครู</p>
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={leaving}
            className="tq-press grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-50 md:hidden"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>

        <CourseSwitch current={course} />

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="เมนูครู">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `tq-press flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? 'bg-white text-action-strong shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(20_45_100/0.1),0_6px_14px_-8px_rgb(20_45_100/0.4)] ring-1 ring-line [&>svg]:text-gold-500'
                    : 'text-ink-2 hover:bg-white/70 hover:text-ink'
                }`
              }
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden flex-col gap-1 border-t border-line px-3 py-4 md:mt-4 md:flex">
          <Link to={previewTo} className="tq-press flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface hover:text-ink">
            <Eye className="size-[18px]" aria-hidden /> ดูหน้านักเรียน
          </Link>
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={leaving}
            className="tq-press flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-50"
          >
            <LogOut className="size-[18px]" aria-hidden /> {leaving ? 'กำลังออก…' : 'ออกจากระบบ'}
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}

function CourseSwitch({ current }: { current: CourseKey }) {
  const item = (key: CourseKey, to: string, dot: string): ReactNode => (
    <Link
      to={to}
      aria-current={current === key ? 'page' : undefined}
      className={`tq-press flex flex-1 items-center justify-center gap-1.5 rounded-[14px] px-2 py-2 text-xs font-semibold ${
        current === key ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
      }`}
    >
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {key === 'm3' ? 'ม.3' : COURSES.db.name}
    </Link>
  )
  return (
    <div className="mx-3 mb-3 flex gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line" role="group" aria-label="สลับวิชา">
      {item('m3', '/admin', 'bg-m3-500')}
      {item('db', '/db/admin', 'bg-db-500')}
    </div>
  )
}
