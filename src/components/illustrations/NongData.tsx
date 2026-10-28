import type { ReactNode } from 'react'

type Mood = 'happy' | 'think' | 'cheer'

interface Props {
  className?: string
  mood?: Mood
  title?: string
}

// น้องดาต้า: หุ่นยนต์ฐานข้อมูลตัวกลม (ตัวเป็นถังฐานข้อมูล 3 ชั้น) ตัวละครนำทางของ DB Quest
export function NongData({ className = 'size-20', mood = 'happy', title = 'น้องดาต้า' }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={title}>
      <line x1="60" y1="10" x2="60" y2="24" className="stroke-db-300 dark:stroke-db-400" strokeWidth="4" strokeLinecap="round" />
      <circle cx="60" cy="9" r="6" className="fill-xp-400" />
      {/* ตัวถังฐานข้อมูล */}
      <path d="M22 34v52c0 9 17 16 38 16s38-7 38-16V34" className="fill-db-400 dark:fill-db-500" />
      <path d="M22 60c0 9 17 16 38 16s38-7 38-16" fill="none" className="stroke-db-600 dark:stroke-db-700" strokeWidth="3" />
      <path d="M22 84c0 9 17 16 38 16s38-7 38-16" fill="none" className="stroke-db-600 dark:stroke-db-700" strokeWidth="3" opacity=".5" />
      <ellipse cx="60" cy="34" rx="38" ry="15" className="fill-db-200 dark:fill-db-300" />
      {/* หน้าจอใบหน้า */}
      <rect x="36" y="44" width="48" height="26" rx="12" className="fill-db-900 dark:fill-db-900" />
      {mood === 'think' ? (
        <>
          <circle cx="50" cy="56" r="4" className="fill-sky-300" />
          <path d="M64 56h8" className="stroke-sky-300" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M45 58q5-6 10 0" fill="none" className="stroke-sky-300" strokeWidth="4" strokeLinecap="round" />
          <path d="M65 58q5-6 10 0" fill="none" className="stroke-sky-300" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      <circle cx="30" cy="70" r="4" className="fill-xp-300" opacity=".8" />
      <circle cx="90" cy="70" r="4" className="fill-xp-300" opacity=".8" />
      {/* แขน */}
      {mood === 'cheer' ? (
        <>
          <path d="M22 66 8 48" className="stroke-db-400 dark:stroke-db-500" strokeWidth="7" strokeLinecap="round" />
          <path d="M98 66l14-18" className="stroke-db-400 dark:stroke-db-500" strokeWidth="7" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M22 70 10 80" className="stroke-db-400 dark:stroke-db-500" strokeWidth="7" strokeLinecap="round" />
          <path d="M98 70l12 10" className="stroke-db-400 dark:stroke-db-500" strokeWidth="7" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// น้องดาต้าพูดในกล่องคำพูด — ใช้ในบทเรียน กล่องเคล็ดลับ และหน้าว่าง
export function NongDataSays({ children, mood = 'happy', className = '' }: { children: ReactNode; mood?: Mood; className?: string }) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <NongData mood={mood} className="size-16 shrink-0 sm:size-20" />
      <div className="relative rounded-[1.5rem] rounded-bl-md bg-white px-4 py-3 text-ink shadow-card ring-1 ring-line dark:bg-dq-900 dark:text-dq-50 dark:ring-dq-800">
        {children}
      </div>
    </div>
  )
}
