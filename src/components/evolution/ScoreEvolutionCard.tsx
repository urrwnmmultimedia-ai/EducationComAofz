import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'
import { EvolutionCelebrationModal, useEvolutionCelebration } from './EvolutionCelebration'
import { scoreEvolutionOf, type ScoreStage } from './scoreEvolution'

type Art = ComponentType<{ stage: number; className?: string; title?: string }>

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 })

// ข้อมูลประกอบในการ์ด: เลเวล XP เหรียญ งานค้าง ความคืบหน้าบทเรียน และงานที่ต้องส่งถัดไป
export interface EvoInfo {
  level?: string // ม.3 มีเลเวลจาก XP · ม.5 ไม่มี
  xp: number
  badges: string // เช่น "3" หรือ "3/8"
  pending: number
  progressPct: number // ความคืบหน้าทั้งวิชา นับทุกคาบ (รวมคาบที่ยังไม่เปิด)
  nextDue?: { title: string; to: string; when: string } | null
}

function Tile({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className={`flex min-w-0 flex-col items-center rounded-2xl px-1 py-1.5 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_4px_10px_-8px_rgb(20_45_100/0.5)] ring-1 ${tone} dark:bg-dq-800 dark:ring-dq-700`}>
      <span className="whitespace-nowrap font-display text-base leading-tight tabular-nums text-ink dark:text-white">
        <span aria-hidden>{icon}</span> {value}
      </span>
      <span className="w-full truncate text-[0.65rem] font-semibold text-ink-2 dark:text-dq-300">{label}</span>
    </div>
  )
}

// การ์ดวิวัฒนาการตามคะแนนรวม 0–100 (ม.3 ลิง → คน · ม.5 ควาย → คน): ตัวละครขั้นปัจจุบันบนแท่น + แถบไปขั้นถัดไป + เส้นทาง 6 ขั้น
// compact: การ์ดเล็กในหน้าหลัก สูงเต็มกรอบที่ให้ (ห่อด้วย EvolutionSlot) แต่ละแถวอยู่บรรทัดเดียว และกระจายแถวเต็มการ์ดไม่เหลือที่ว่าง
// celebrateKey: ขึ้นขั้นใหม่แล้วเปิดหน้าต่างแสดงความยินดีกลางจอ (null = ไม่ฉลอง เช่น ครูดูตัวอย่าง)
export function ScoreEvolutionCard({
  score,
  stages,
  art: ArtC,
  pathLabel,
  celebrateKey = null,
  footer,
  info,
  compact = false,
  className = '',
}: {
  score: number
  stages: ScoreStage[]
  art: Art
  pathLabel: string
  celebrateKey?: string | null
  footer?: ReactNode
  info?: EvoInfo
  compact?: boolean
  className?: string
}) {
  const e = scoreEvolutionOf(score, stages)
  const total = stages.length
  const party = useEvolutionCelebration(celebrateKey, e.index)
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-white via-white to-brand-50 shadow-raise ring-1 ring-line dark:from-dq-900 dark:via-dq-900 dark:to-dq-950 dark:ring-dq-800 ${compact ? 'h-full justify-between gap-2 p-4' : 'gap-5 p-5 sm:p-6'} ${className}`}
    >
      <span className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-gold-300/25 blur-3xl" aria-hidden />
      <div className={`relative flex items-center ${compact ? 'gap-3' : 'flex-wrap gap-4 sm:gap-6'}`}>
        {/* ตัวละครบนแท่นเหรียญ */}
        <div className="relative shrink-0">
          <div
            className={`grid place-items-center rounded-full bg-[radial-gradient(circle_at_50%_32%,#ffffff,#eaf3ff_55%,#c9ddfb)] shadow-[inset_0_-8px_16px_rgb(31_86_214/0.18),0_16px_30px_-14px_rgb(20_45_100/0.6)] ${
              compact ? 'size-16 ring-[3px] ring-gold-300' : 'size-32 ring-4 ring-gold-300 sm:size-36'
            }`}
          >
            <ArtC
              stage={e.index}
              className={`drop-shadow-[0_6px_6px_rgb(20_45_100/0.25)] ${compact ? 'size-14' : 'size-28 sm:size-32'}`}
              title={e.stage.name}
            />
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-gold-300 to-gold-400 px-2 py-px text-[0.65rem] font-bold text-ink dark:text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_4px_10px_-4px_rgb(180_130_0/0.7)] ring-1 ring-gold-500/50">
            ขั้น {e.index + 1}/{total}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-2 dark:text-dq-300">
            วิวัฒนาการของฉัน
            {info?.level && <span className="truncate rounded-full bg-xp-300/40 px-2 py-px font-semibold text-ink dark:text-white">{info.level}</span>}
          </p>
          <p className={`flex items-baseline gap-2 font-bold leading-tight text-ink dark:text-white ${compact ? 'text-lg' : 'text-2xl sm:text-[1.7rem]'}`}>
            <span className="truncate">{e.stage.name}</span>
            <span className="shrink-0 rounded-full bg-action-soft px-2 py-0.5 text-xs font-semibold text-action-strong">
              <span className="font-display tabular-nums">{fmt(score)}</span>/100
            </span>
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-2 dark:text-dq-300">{e.stage.tagline}</p>
        </div>
      </div>

      <div className="relative">
        {e.next ? (
          <>
            <p className="mb-1 flex items-baseline justify-between gap-2 whitespace-nowrap text-sm">
              <span className="min-w-0 truncate font-semibold text-ink dark:text-white">
                อีก {fmt(e.toNext)} คะแนน → {e.next.name}
              </span>
              <span className="shrink-0 tabular-nums text-ink-2 dark:text-dq-300">{e.next.minScore} คะแนน</span>
            </p>
            <div
              className="h-3 overflow-hidden rounded-full bg-surface dark:bg-dq-800 shadow-[inset_0_1px_3px_rgb(20_45_100/0.2)]"
              role="progressbar"
              aria-label={`ความคืบหน้าไปขั้น ${e.next.name}`}
              aria-valuenow={Math.round(e.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-action to-gold-400 shadow-[0_0_10px_rgb(241_196_67/0.55)] transition-[width] duration-700"
                style={{ width: `${Math.max(e.progress * 100, 3)}%` }}
              />
            </div>
          </>
        ) : (
          <p className="truncate rounded-2xl bg-gradient-to-r from-gold-300/60 to-gold-400/40 px-4 py-2 text-sm font-semibold text-ink dark:text-white">
            🏆 วิวัฒนาการครบทุกขั้นแล้ว สุดยอดมาก!
          </p>
        )}
      </div>

      {info && (
        <div className="relative space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            <Tile icon="📝" label="งานค้าง" value={String(info.pending)} tone={info.pending > 0 ? 'bg-rose-50 ring-rose-200' : 'bg-emerald-50 ring-emerald-200'} />
            <Tile icon="📚" label="เรียนแล้ว (ทุกคาบ)" value={`${info.progressPct}%`} tone="bg-sky-50 ring-sky-200" />
            <Tile icon="✨" label="XP" value={info.xp.toLocaleString('th-TH')} tone="bg-amber-50 ring-amber-200" />
            <Tile icon="🏅" label="เหรียญ" value={info.badges} tone="bg-violet-50 ring-violet-200" />
          </div>
          {info.nextDue ? (
            <Link
              to={info.nextDue.to}
              className="tq-press flex items-center gap-2 whitespace-nowrap rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-line dark:bg-dq-800 dark:ring-dq-700 hover:bg-surface/70"
            >
              <span className="shrink-0 text-xs font-semibold text-rose-600">ส่งถัดไป</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink dark:text-white">{info.nextDue.title}</span>
              <span className="shrink-0 text-xs text-ink-2 dark:text-dq-300">{info.nextDue.when} →</span>
            </Link>
          ) : (
            <p className="truncate rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">✓ ไม่มีงานค้าง เยี่ยมมาก</p>
          )}
        </div>
      )}

      {/* เส้นทางวิวัฒนาการ: ตัวละครสูงขึ้นทีละขั้น ขั้นที่ยังไม่ถึงเป็นเงาดำ */}
      <ol
        className={`relative flex items-end justify-between gap-1 border-t border-line dark:border-dq-800 ${compact ? 'pt-2' : 'mt-auto pt-4'}`}
        aria-label={`เส้นทางวิวัฒนาการ ${pathLabel}`}
      >
        <span className="pointer-events-none absolute inset-x-6 bottom-6 h-1 rounded-full bg-gradient-to-r from-amber-700/30 via-action/30 to-gold-400/60" aria-hidden />
        {stages.map((s, i) => {
          const reached = i <= e.index
          const sizes = compact
            ? ['size-7', 'size-8', 'size-8', 'size-9', 'size-9', 'size-10']
            : ['size-9', 'size-10', 'size-11', 'size-12', 'size-[3.25rem]', 'size-14']
          return (
            <li key={s.name} className="relative flex flex-1 flex-col items-center gap-0.5" title={`${s.name} · ${s.minScore} คะแนนขึ้นไป`}>
              <span className={`rounded-full p-0.5 ${i === e.index ? 'bg-gold-300/50 shadow-[0_0_14px_rgb(241_196_67/0.6)] ring-2 ring-gold-400' : ''}`}>
                <ArtC stage={i} className={`${sizes[i] ?? 'size-9'} ${reached ? '' : 'opacity-25 brightness-0'}`} />
              </span>
              <span className={`text-[0.65rem] font-semibold tabular-nums ${i === e.index ? 'text-gold-600' : reached ? 'text-ink-2 dark:text-dq-300' : 'text-slate-400'}`}>{s.minScore}</span>
              <span className="sr-only">
                {s.name}
                {i === e.index ? ' (ขั้นปัจจุบัน)' : reached ? ' (ผ่านแล้ว)' : ' (ยังไม่ถึง)'}
              </span>
            </li>
          )
        })}
      </ol>
      {footer}
      {party && (
        <EvolutionCelebrationModal
          art={ArtC}
          from={party.from}
          to={party.to}
          fromName={stages[party.from]?.name ?? ''}
          toName={stages[party.to]?.name ?? ''}
          tagline={stages[party.to]?.tagline ?? ''}
          onClose={party.close}
        />
      )}
    </section>
  )
}

// ช่องวางการ์ดวิวัฒนาการข้างการ์ดเรียนต่อ: จอกว้างสูงเท่าการ์ดข้าง ๆ พอดี (ไม่ดันแถวให้สูงขึ้น)
// h-0 + min-h-full = ไม่นับความสูงตัวเองตอนจัดแถว แต่ยืดเต็มความสูงแถว · ระยะบน-ล่างเท่าการ์ดเรียนต่อ (ใช้ padding แทน margin)
// fit=false (การ์ดข้าง ๆ เตี้ย เช่น ยังไม่มีคาบเปิด): ใช้ความสูงของการ์ดเองตามปกติ กันเนื้อหาถูกตัด
export function EvolutionSlot({ fit = true, children }: { fit?: boolean; children: ReactNode }) {
  return <div className={`min-w-0 ${fit ? 'pb-4 pt-3 sm:pt-6 lg:h-0 lg:min-h-full lg:pb-6 lg:pt-10' : ''}`}>{children}</div>
}
