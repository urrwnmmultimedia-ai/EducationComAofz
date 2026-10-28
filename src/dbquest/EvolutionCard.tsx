import type { ReactNode } from 'react'
import { EVO_STAGES, evolutionOf } from './evolution'
import { EvolutionArt } from './EvolutionArt'

function Meter({ label, value, max, progress, unit }: { label: string; value: number; max: number; progress: number; unit: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-2 dark:text-dq-300">{label}</span>
        <span className="font-semibold tabular-nums text-ink dark:text-white">
          {value.toLocaleString('th-TH')} / {max.toLocaleString('th-TH')} {unit}
        </span>
      </div>
      <div
        className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface shadow-[inset_0_1px_2px_rgb(20_45_100/0.15)] dark:bg-dq-800"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-action to-gold-400" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}

// เลเวลของ DB Quest: ภาพขั้นปัจจุบัน + เงื่อนไขขึ้นขั้นถัดไป (XP และคาบที่เรียนครบ) + เส้นทาง 6 ขั้น
export function EvolutionCard({ xp, sessionsDone, footer, className = '' }: { xp: number; sessionsDone: number; footer?: ReactNode; className?: string }) {
  const e = evolutionOf(xp, sessionsDone)
  return (
    <section className={`tq-card flex flex-col gap-4 p-5 sm:p-6 dark:bg-dq-900 dark:ring-dq-800 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="relative grid size-28 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,#ffffff,#e6f4ff_55%,#c6e5fd)] shadow-[inset_0_-6px_12px_rgb(28_139_223/0.18),0_10px_22px_-12px_rgb(20_45_100/0.5)] ring-2 ring-gold-300">
          <EvolutionArt stage={e.index} className="size-24" title={e.stage.name} />
          <span className="absolute -bottom-1 rounded-full bg-gradient-to-b from-gold-300 to-gold-400 px-2.5 py-0.5 text-xs font-bold text-ink shadow-sm ring-1 ring-gold-500/50">
            ขั้น {e.index + 1}/{EVO_STAGES.length}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ink-2 dark:text-dq-300">วิวัฒนาการของฉัน</p>
          <p className="text-xl font-bold leading-tight text-ink dark:text-white">{e.stage.name}</p>
          <p className="mt-0.5 text-sm text-ink-2 dark:text-dq-300">{e.stage.tagline}</p>
        </div>
      </div>

      {e.next ? (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-ink dark:text-white">
            ไปเป็น “{e.next.name}” ต้องมีครบทั้งสองอย่าง
          </p>
          <Meter label="XP" value={xp} max={e.next.minXp} progress={e.xpToNext === 0 ? 1 : e.xpProgress} unit="XP" />
          <Meter
            label="คาบที่เรียนครบ"
            value={sessionsDone}
            max={e.next.minSessions}
            progress={e.sessionsToNext === 0 ? 1 : e.sessionProgress}
            unit="คาบ"
          />
        </div>
      ) : (
        <p className="rounded-2xl bg-gold-300/40 px-4 py-2 text-sm font-semibold text-ink">วิวัฒนาการครบทุกขั้นแล้ว เยี่ยมมาก</p>
      )}

      <ol className="flex items-end justify-between gap-1 border-t border-line pt-3 dark:border-dq-800" aria-label="เส้นทางวิวัฒนาการ">
        {EVO_STAGES.map((s, i) => (
          <li key={s.name} className="flex flex-1 flex-col items-center" title={`${i + 1}. ${s.name}`}>
            <EvolutionArt
              stage={i}
              className={`size-9 sm:size-10 ${i === e.index ? 'rounded-full bg-gold-300/40 ring-2 ring-gold-400' : i > e.index ? 'opacity-35 grayscale brightness-50' : ''}`}
            />
            <span className="sr-only">
              {i + 1}. {s.name}
              {i === e.index ? ' (ขั้นปัจจุบัน)' : i > e.index ? ' (ยังไม่ถึง)' : ' (ผ่านแล้ว)'}
            </span>
          </li>
        ))}
      </ol>
      {footer}
    </section>
  )
}
