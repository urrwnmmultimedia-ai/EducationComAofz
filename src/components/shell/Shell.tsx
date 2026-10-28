import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { Lock, Sparkles } from 'lucide-react'
import { BRAND, COURSES, type CourseKey } from '@/app/brand'

// โครงหน้าที่ใช้ร่วมกันทั้ง ม.3 และ DB Quest: แถบแบรนด์ด้านบน + แถบเมนูนิ้วโป้งด้านล่าง

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  // เมนูที่ยังไม่เปิดใช้: แสดงจาง มีกุญแจ กดไม่ได้
  locked?: boolean
}

const LOCKED_TITLE = 'ยังไม่เปิดใช้ จะเปิดเมื่อเรียนถึงช่วงนั้น'

const COURSE_TONE: Record<CourseKey, string> = {
  m3: 'bg-m3-50 text-m3-700 ring-m3-100 dark:bg-m3-700/30 dark:text-m3-100 dark:ring-m3-700/40',
  db: 'bg-db-50 text-db-700 ring-db-100 dark:bg-db-700/30 dark:text-db-100 dark:ring-db-700/40',
}

export function CourseChip({ course, className = '' }: { course: CourseKey; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${COURSE_TONE[course]} ${className}`}>
      <span className={`size-1.5 rounded-full ${course === 'm3' ? 'bg-m3-500' : 'bg-db-500'}`} aria-hidden />
      {COURSES[course].name}
    </span>
  )
}

// ตราโรงเรียนบนเหรียญนูน (ใช้ทุกที่ที่มีตรา)
export function CrestMedallion({ className = 'size-11', alt = `ตรา ${BRAND.school.short}` }: { className?: string; alt?: string }) {
  return (
    <span className={`tq-medallion shrink-0 ${className}`}>
      <img src={BRAND.school.logo} alt={alt} width={96} height={96} />
    </span>
  )
}

// ชุดโลโก้เต็ม: เหรียญตรา + TechQuest + ขีดทอง + ชื่อโรงเรียน (หน้าล็อกอิน)
export function BrandLockup({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <CrestMedallion className="size-[4.5rem] lg:size-[5.5rem]" />
      <div className="leading-none">
        <p className="text-[2rem] font-bold tracking-[-0.03em] text-ink [text-shadow:0_1px_0_rgb(255_255_255/0.9),0_8px_18px_rgb(20_45_100/0.16)] lg:text-[2.6rem]">
          {BRAND.name}
        </p>
        <span className="mt-2.5 block h-1 w-10 rounded-full bg-gold-400 shadow-[0_3px_8px_-2px_rgb(217_165_20/0.7)]" aria-hidden />
        <p className="mt-2.5 text-sm font-semibold tracking-[0.18em] text-ink-2">{BRAND.school.short}</p>
      </div>
    </div>
  )
}

// ตราโรงเรียน + TechQuest + วิชาที่อยู่ (แถบบน)
export function BrandMark({ course, to, compact = false }: { course?: CourseKey; to: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-3" aria-label={`${BRAND.name} หน้าแรก`}>
      <CrestMedallion className="size-10 sm:size-11" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[1.05rem] font-bold tracking-tight text-ink dark:text-white">{BRAND.name}</span>
        {course && !compact ? (
          <CourseChip course={course} className="mt-0.5" />
        ) : (
          <span className="block text-xs text-ink-2 dark:text-dq-300">{BRAND.school.short}</span>
        )}
      </span>
    </Link>
  )
}

// XP: เหรียญทองนูน
export function XpPill({ xp }: { xp: number }) {
  return (
    <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-b from-gold-300 to-gold-400 px-3 py-1 text-sm font-bold min-[420px]:inline-flex text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-1px_0_rgb(140_100_0/0.25),0_4px_10px_-4px_rgb(180_130_0/0.6)] ring-1 ring-gold-500/50">
      <Sparkles className="size-4 text-gold-600" aria-hidden />
      {xp.toLocaleString('th-TH')} XP
    </span>
  )
}

// แถบบน: ขาวลอยเหนือหน้า มีเงาน้ำเงินนุ่ม + เส้นทองบาง ๆ ที่ขอบล่าง
export function TopBar({ left, children }: { left: ReactNode; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-white/85 shadow-[0_10px_30px_-18px_rgb(20_45_100/0.45)] backdrop-blur-md dark:bg-dq-950/85 dark:shadow-[0_10px_30px_-18px_rgb(0_0_0/0.8)]">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <div className="min-w-0 flex-1">{left}</div>
        {children}
      </div>
      <div className="tq-gold-line h-px opacity-80" aria-hidden />
    </header>
  )
}

// เมนูบนจอกว้าง: ถาดเว้าลงไป + ปุ่มที่เลือกยกนูนขึ้นมา มีขีดทองใต้
export function TopNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="hidden shrink-0 items-center gap-0.5 rounded-full bg-surface/80 p-1 shadow-[inset_0_2px_5px_rgb(20_45_100/0.1),inset_0_-1px_0_rgb(255_255_255/0.9)] ring-1 ring-line lg:flex dark:bg-dq-900 dark:ring-dq-800"
      aria-label="เมนูหลัก"
    >
      {items.map(({ to, label, icon: Icon, end, locked }) =>
        locked ? (
          <span
            key={to}
            role="link"
            aria-disabled="true"
            title={LOCKED_TITLE}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-400 dark:text-dq-800"
          >
            <Lock className="size-3.5" aria-hidden />
            {label}
            <span className="sr-only">(ยังไม่เปิด)</span>
          </span>
        ) : (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `tq-press relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                isActive
                  ? 'bg-white text-action-strong shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(20_45_100/0.12),0_6px_14px_-6px_rgb(20_45_100/0.4)] ring-1 ring-line after:absolute after:inset-x-4 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gold-400 dark:bg-dq-800 dark:text-white dark:ring-dq-800'
                  : 'text-ink-2 hover:bg-white/60 hover:text-ink dark:text-dq-200 dark:hover:bg-dq-800'
              }`
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ),
      )}
    </nav>
  )
}

// แถบเมนูล่างบนมือถือ: การ์ดลอยเหนือขอบจอ ขอบบนทอง · ปุ่มที่เลือกเป็นปุ่มน้ำเงินนูน
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto max-w-[560px] z-20 overflow-hidden rounded-[1.625rem] bg-white/95 p-1.5 shadow-[0_2px_4px_rgb(20_45_100/0.08),0_20px_40px_-14px_rgb(20_45_100/0.45)] ring-1 ring-line backdrop-blur lg:hidden dark:bg-dq-900/95 dark:ring-dq-800"
      aria-label="เมนูหลัก"
    >
      <div className="tq-gold-line absolute inset-x-6 top-0 h-px" aria-hidden />
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ to, label, icon: Icon, end, locked }) => (
          <li key={to}>
            {locked ? (
              <span
                role="link"
                aria-disabled="true"
                title={LOCKED_TITLE}
                className="relative flex min-h-14 cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-[1.25rem] text-[0.7rem] font-semibold text-slate-400 dark:text-dq-800"
              >
                <Icon className="size-[1.375rem] opacity-60" strokeWidth={2.1} aria-hidden />
                <Lock className="absolute right-[22%] top-2 size-3" aria-hidden />
                {label}
                <span className="sr-only">(ยังไม่เปิด)</span>
              </span>
            ) : (
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `tq-press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.25rem] text-[0.7rem] font-semibold ${
                    isActive ? 'bg-action text-white shadow-action' : 'text-ink-2 dark:text-dq-300'
                  }`
                }
              >
                <Icon className="size-[1.375rem]" strokeWidth={2.1} aria-hidden />
                {label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PreviewBanner({ children }: { children: ReactNode }) {
  return <div className="bg-gradient-to-b from-gold-300 to-gold-400 px-4 py-2 text-center text-sm text-ink">{children}</div>
}

// ฉากหลังรูปโรงเรียน: hero = ล็อกอิน · band = หน้าหลักนักเรียน · soft = หน้าเรียน · faint = หน้าครู
export type BackdropVariant = 'hero' | 'band' | 'soft' | 'faint'
export function Backdrop({ variant }: { variant: BackdropVariant }) {
  return <div className={`tq-backdrop tq-backdrop--${variant}`} aria-hidden />
}
