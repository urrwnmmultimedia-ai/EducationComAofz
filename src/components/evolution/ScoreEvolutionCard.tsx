import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'
import { EvolutionCelebrationModal, useEvolutionCelebration } from './EvolutionCelebration'
import { computeGrade, formatGrade, type GradeStep } from '@/lib/grade'
import { GRADE_BANDS, scoreEvolutionOf, type ScoreStage } from './scoreEvolution'

type Art = ComponentType<{ stage: number; className?: string; title?: string }>

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 })

// ข้อมูลประกอบในการ์ด: เหรียญรายคาบ งานค้าง ความคืบหน้าบทเรียน และงานที่ต้องส่งถัดไป
export interface EvoInfo {
  medals: { gold: number; silver: number; bronze: number }
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

// การ์ดวิวัฒนาการตามคะแนนที่ทำได้ตอนนี้ 0–100 (ช่วง 0–49 มีขั้นย่อยทุก 10 คะแนน) (เฉพาะคาบที่ครูเปิดแล้ว) (ม.3 ลิง → คน · ม.5 ควาย → คน): ตัวละครขั้นปัจจุบันบนแท่น + แถบไปขั้นถัดไป + เส้นทาง 8 ขั้น (= เกรด 0–4)
// compact: การ์ดเล็กในหน้าหลัก สูงเต็มกรอบที่ให้ (ห่อด้วย EvolutionSlot) แต่ละแถวอยู่บรรทัดเดียว และกระจายแถวเต็มการ์ดไม่เหลือที่ว่าง
// celebrateKey: ขึ้นขั้นใหม่แล้วเปิดหน้าต่างแสดงความยินดีกลางจอ (null = ไม่ฉลอง เช่น ครูดูตัวอย่าง)
export function ScoreEvolutionCard({
  score,
  stages,
  art: ArtC,
  pathLabel,
  celebrateKey = null,
  gradeScale,
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
  // เกณฑ์เกรดของครู (app_settings) — ไม่ส่ง = เกณฑ์มาตรฐาน
  gradeScale?: readonly GradeStep[]
  footer?: ReactNode
  info?: EvoInfo
  compact?: boolean
  className?: string
}) {
  const e = scoreEvolutionOf(score, stages)
  const mains = stages.filter((s) => s.minor === 0).length
  const party = useEvolutionCelebration(celebrateKey, e.index)
  // เกรดคิดแบบเดียวกับสมุดคะแนน (คะแนนรวม + เกณฑ์ของครู) ตัวเลขจึงตรงกันทุกหน้า
  const grade = formatGrade(computeGrade(score, gradeScale))
  const gradeLabel = GRADE_BANDS.find((b) => b.grade === grade)?.gradeLabel
  return (
    <section
      className={`tq-evo-card relative flex flex-col overflow-hidden rounded-[1.75rem] ${compact ? 'h-full justify-between gap-2 p-4' : 'gap-5 p-5 sm:p-6'} ${className}`}
    >
      <span className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-gold-300/25 blur-3xl" aria-hidden />
      <div className={`relative flex items-center ${compact ? 'gap-3' : 'flex-wrap gap-4 sm:gap-6'}`}>
        {/* ตัวละครลอยอยู่บนแท่นทรงกระบอก มีรัศมีทองหมุนช้า ๆ ด้านหลัง */}
        <div className={`relative shrink-0 ${compact ? 'pb-1' : 'pb-3'}`}>
          <span aria-hidden className={`tq-evo-aura pointer-events-none absolute left-1/2 -translate-x-1/2 ${compact ? '-top-1 size-[4.5rem]' : '-top-2 size-40 sm:size-44'}`} />
          <div className={`tq-evo-orb relative grid place-items-center rounded-full ${compact ? 'size-16' : 'size-32 sm:size-36'}`}>
            <span className="tq-evo-float grid place-items-center">
              <ArtC
                stage={e.index}
                className={`drop-shadow-[0_8px_6px_rgb(20_45_100/0.28)] ${compact ? 'size-14' : 'size-28 sm:size-32'}`}
                title={e.stage.name}
              />
            </span>
          </div>
          <span aria-hidden className={`tq-evo-podium absolute left-1/2 -translate-x-1/2 ${compact ? 'bottom-0 h-2.5 w-14' : 'bottom-0 h-4 w-28 sm:w-32'}`} />
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-gold-300 to-gold-400 px-2 py-px text-[0.65rem] font-bold text-ink dark:text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_4px_10px_-4px_rgb(180_130_0/0.7)] ring-1 ring-gold-500/50">
            ขั้น {e.main + 1}/{mains}
            {e.stage.minor > 0 && ` · ย่อย ${e.stage.minor}`}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-2 dark:text-dq-300">
            วิวัฒนาการของฉัน
            <span className="truncate rounded-full bg-gold-300/50 px-2 py-px font-semibold text-ink dark:text-white">
              เกรด {grade}
              {gradeLabel && ` · ${gradeLabel}`}
            </span>
          </p>
          <p className={`flex items-baseline gap-2 font-bold leading-tight text-ink dark:text-white ${compact ? 'text-lg' : 'text-2xl sm:text-[1.7rem]'}`}>
            <span className="truncate">{e.stage.name}</span>
            <span className="shrink-0 rounded-full bg-action-soft px-2 py-0.5 text-xs font-semibold text-action-strong" title="คะแนนรวมจาก 100 คะแนน (เท่ากับในสมุดคะแนน)">
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
                อีก {fmt(e.toNext)}% → {e.next.name} (เกรด {e.next.grade})
              </span>
              <span className="shrink-0 tabular-nums text-ink-2 dark:text-dq-300">{e.next.minScore}%</span>
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
                className="tq-evo-shine h-full rounded-full bg-gradient-to-r from-action to-gold-400 shadow-[0_0_10px_rgb(241_196_67/0.55)] transition-[width] duration-700"
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
          <div className="grid grid-cols-5 gap-1.5">
            <Tile icon="📝" label="งานค้าง" value={String(info.pending)} tone={info.pending > 0 ? 'bg-rose-50 ring-rose-200' : 'bg-emerald-50 ring-emerald-200'} />
            <Tile icon="📚" label="เรียนแล้ว" value={`${info.progressPct}%`} tone="bg-sky-50 ring-sky-200" />
            <Tile icon="🥇" label="ทอง" value={String(info.medals.gold)} tone="bg-amber-50 ring-amber-200" />
            <Tile icon="🥈" label="เงิน" value={String(info.medals.silver)} tone="bg-slate-50 ring-slate-200" />
            <Tile icon="🥉" label="ทองแดง" value={String(info.medals.bronze)} tone="bg-orange-50 ring-orange-200" />
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
          if (s.minor > 0) {
            return (
              <li key={s.name} className="relative flex flex-col items-center gap-0.5 self-end" title={`${s.name} · ทำได้ ${s.minScore}% ขึ้นไป`}>
                <span className={`tq-evo-token grid place-items-center ${i === e.index ? 'tq-evo-token--now' : ''} ${compact ? 'size-5' : 'size-7'}`}>
                  <ArtC stage={s.art} className={`${compact ? 'size-4' : 'size-6'} ${reached ? '' : 'opacity-25 brightness-0 dark:opacity-30 dark:invert'}`} />
                </span>
                <span className={`tabular-nums ${compact ? 'invisible text-[0.65rem]' : 'text-[0.6rem]'} ${i === e.index ? 'font-semibold text-gold-600' : 'text-slate-400'}`}>{s.minScore}</span>
                <span className="sr-only">
                  {s.name}
                  {i === e.index ? ' (ขั้นปัจจุบัน)' : reached ? ' (ผ่านแล้ว)' : ' (ยังไม่ถึง)'}
                </span>
              </li>
            )
          }
          const sizes = compact
            ? ['size-6', 'size-6', 'size-7', 'size-7', 'size-8', 'size-8', 'size-9', 'size-9']
            : ['size-8', 'size-9', 'size-9', 'size-10', 'size-11', 'size-12', 'size-[3.25rem]', 'size-14']
          return (
            <li key={s.name} className="relative flex flex-1 flex-col items-center gap-0.5" title={`${s.name} · ทำได้ ${s.minScore}% ขึ้นไป · เกรด ${s.grade}`}>
              <span className={`tq-evo-token p-0.5 ${i === e.index ? 'tq-evo-token--now' : ''}`}>
                <ArtC stage={s.art} className={`${sizes[s.main] ?? 'size-9'} ${reached ? '' : 'opacity-25 brightness-0 dark:opacity-30 dark:invert'}`} />
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
