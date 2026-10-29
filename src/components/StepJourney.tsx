import type { LucideIcon } from 'lucide-react'
import { Check, Lock } from 'lucide-react'

// เส้นทาง 6 ขั้นในคาบ (ใช้แบบเดียวกันทั้ง ม.3 และ DB Quest)
// รางเว้าเชื่อมทุกขั้น ส่วนที่ผ่านแล้วเติมน้ำเงิน→ทอง · ผ่านแล้ว = เหรียญน้ำเงินนูนขอบทอง · ขั้นปัจจุบัน = เหรียญขาวยกสูง

export interface JourneyStep {
  key: string
  label: string
  icon: LucideIcon
}

interface Props {
  steps: JourneyStep[]
  current: string
  done: ReadonlySet<string>
  onSelect: (key: string) => void
  label?: string
  locked?: ReadonlySet<string> // ขั้นที่ยังไปไม่ได้ (ต้องผ่านขั้นก่อนหน้าก่อน)
}

export function StepJourney({ steps, current, done, onSelect, label = 'ขั้นในคาบ', locked }: Props) {
  const n = steps.length
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.key === current),
  )
  const lastDone = steps.reduce((m, s, i) => (done.has(s.key) ? i : m), -1)
  const fill = n > 1 ? (Math.max(lastDone, 0) / (n - 1)) * 100 : 0
  const doneCount = steps.filter((s) => done.has(s.key)).length

  return (
    <nav aria-label={label} className="tq-card px-3 pb-2 pt-4 sm:px-5 dark:bg-dq-900 dark:ring-dq-800">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 px-1 text-sm">
        <p className="font-semibold text-ink dark:text-white">
          ขั้นที่ {currentIdx + 1} จาก {n}
        </p>
        <p className="text-ink-2 dark:text-dq-300">
          ผ่านแล้ว <span className="font-semibold tabular-nums text-action-strong dark:text-dq-300">{doneCount}</span> ขั้น
        </p>
      </div>

      {/* เว้นที่บน-ล่าง-ข้าง ให้เหรียญที่ยกขึ้น ขอบหนา และวงแสง (12px) ไม่ถูกกล่องเลื่อนตัด */}
      <div className="-mx-3 overflow-x-auto px-4 pb-2 pt-4 sm:-mx-2 sm:px-3">
        <ol className="relative grid min-w-[30rem]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {/* ราง: ร่องเว้า + ส่วนที่ผ่านแล้ว */}
          <div
            className="absolute top-[1.625rem] h-2 -translate-y-1/2 rounded-full bg-surface shadow-[inset_0_1px_3px_rgb(20_45_100/0.18)] sm:top-[1.875rem] dark:bg-dq-800"
            style={{ left: `${50 / n}%`, right: `${50 / n}%` }}
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-action via-action to-gold-400 shadow-[0_0_10px_rgb(31_86_214/0.35)] transition-[width] duration-700 ease-[var(--ease-out-expo)]"
              style={{ width: `${fill}%` }}
            />
          </div>

          {steps.map((s, i) => {
            const isDone = done.has(s.key)
            const isCurrent = s.key === current
            const isLocked = !!locked?.has(s.key)
            const Icon = isLocked ? Lock : s.icon
            return (
              <li key={s.key} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(s.key)}
                  disabled={isLocked}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`ขั้นที่ ${i + 1} ${s.label}${isDone ? ' (ผ่านแล้ว)' : isLocked ? ' (ยังล็อก ทำขั้นก่อนหน้าให้ผ่านก่อน)' : ''}`}
                  className="group flex flex-col items-center gap-1.5 rounded-2xl px-1 pb-1 outline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className={`relative grid size-[3.25rem] place-items-center rounded-full transition duration-300 sm:size-[3.75rem] ${
                      isCurrent
                        ? 'bg-[radial-gradient(circle_at_35%_28%,#ffffff,#eef4ff_60%,#d8e5fb)] text-action shadow-[inset_0_2px_1px_rgb(255_255_255),inset_0_-3px_6px_rgb(31_86_214/0.15),0_10px_20px_-8px_rgb(20_45_100/0.55)] ring-[3px] ring-action -translate-y-1'
                        : isDone
                          ? 'bg-[radial-gradient(circle_at_35%_28%,#5f8ce9,#1f56d6_55%,#163fa6)] text-white shadow-[inset_0_2px_1px_rgb(255_255_255/0.35),inset_0_-3px_5px_rgb(5_20_70/0.35),0_8px_16px_-8px_rgb(31_86_214/0.8)] ring-2 ring-gold-400 group-hover:-translate-y-0.5'
                          : 'bg-white text-slate-400 shadow-[inset_0_1px_0_rgb(255_255_255),0_3px_8px_-4px_rgb(20_45_100/0.3)] ring-1 ring-line group-hover:-translate-y-0.5 group-hover:text-ink-2 dark:bg-dq-900 dark:ring-dq-800'
                    }`}
                  >
                    {isCurrent && <span className="tq-pulse absolute inset-0 rounded-full" aria-hidden />}
                    {isDone && !isCurrent ? <Check className="size-6" strokeWidth={3} aria-hidden /> : <Icon className="size-6" aria-hidden />}
                    {isDone && isCurrent && (
                      <span
                        className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-gold-400 text-ink shadow-sm"
                        aria-hidden
                      >
                        <Check className="size-3" strokeWidth={3.5} />
                      </span>
                    )}
                  </span>
                  <span className="text-center leading-tight">
                    <span className={`block text-[0.7rem] font-semibold ${isDone ? 'text-gold-600' : 'text-slate-400'}`}>ขั้น {i + 1}</span>
                    <span
                      className={`block text-xs sm:text-sm ${
                        isCurrent
                          ? 'font-bold text-ink dark:text-white'
                          : isDone
                            ? 'font-semibold text-ink-2 dark:text-dq-200'
                            : 'text-slate-500 dark:text-dq-300'
                      }`}
                    >
                      {s.label}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}

// แถบย่อ "ในคาบนี้มีอะไรบ้าง" (ใช้ในการ์ดเรียนต่อ หน้าหลัก)
export function StepPreview({ steps }: { steps: { label: string; icon: LucideIcon }[] }) {
  return (
    // บรรทัดเดียวเสมอ: ไม่ตัดขึ้นบรรทัดใหม่ จอแคบมากเลื่อนแนวนอนได้
    <ol className="-mx-1 flex flex-nowrap items-center gap-0.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="ขั้นในคาบนี้">
      {steps.map(({ label, icon: Icon }, i) => (
        <li key={label} className="flex shrink-0 items-center gap-0.5">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[0.7rem] font-semibold sm:px-2.5 sm:text-xs text-ink-2 ring-1 ring-line dark:bg-dq-800 dark:text-dq-200 dark:ring-dq-800">
            <Icon className="size-3 shrink-0 text-action sm:size-3.5 dark:text-dq-300" aria-hidden />
            {label}
          </span>
          {i < steps.length - 1 && (
            <span className="text-xs text-slate-300" aria-hidden>
              ›
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
