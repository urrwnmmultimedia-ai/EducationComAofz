import { z } from 'zod'

// เหรียญรายคาบ (เซิร์ฟเวอร์คำนวณสด): ทอง ≥ 90% · เงิน ≥ 75% · ทองแดง ≥ 50% ของคะแนนในคาบนั้น

export const medalSchema = z.object({
  session_no: z.number(),
  pct: z.coerce.number(),
  tier: z.enum(['gold', 'silver', 'bronze']).nullable(),
})
export type Medal = z.infer<typeof medalSchema>
export type MedalTier = NonNullable<Medal['tier']>
export type MedalCounts = { gold: number; silver: number; bronze: number }

export const TIER_INFO: Record<MedalTier, { icon: string; name: string; min: number; tone: string }> = {
  gold: { icon: '🥇', name: 'ทอง', min: 90, tone: 'bg-amber-50 ring-amber-300 dark:bg-amber-950/40 dark:ring-amber-700' },
  silver: { icon: '🥈', name: 'เงิน', min: 75, tone: 'bg-slate-50 ring-slate-300 dark:bg-slate-900 dark:ring-slate-600' },
  bronze: { icon: '🥉', name: 'ทองแดง', min: 50, tone: 'bg-orange-50 ring-orange-300 dark:bg-orange-950/40 dark:ring-orange-700' },
}

export function countMedals(medals: Medal[]): MedalCounts {
  const c = { gold: 0, silver: 0, bronze: 0 }
  for (const m of medals) if (m.tier) c[m.tier]++
  return c
}

const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 1 })

// ชั้นวางเหรียญ: สรุปจำนวน + รายคาบ (คาบที่ยังไม่ได้เหรียญบอกว่าขาดอีกเท่าไร)
export function MedalShelf({ medals, sessionTitle }: { medals: Medal[]; sessionTitle?: (no: number) => string | undefined }) {
  const c = countMedals(medals)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(['gold', 'silver', 'bronze'] as const).map((t) => (
          <div key={t} className={`rounded-2xl p-3 text-center ring-1 ${TIER_INFO[t].tone}`}>
            <p className="text-3xl" aria-hidden>
              {TIER_INFO[t].icon}
            </p>
            <p className="font-display text-2xl tabular-nums text-ink dark:text-white">{c[t]}</p>
            <p className="text-sm text-ink-2 dark:text-dq-300">
              {TIER_INFO[t].name} · ≥ {TIER_INFO[t].min}%
            </p>
          </div>
        ))}
      </div>
      {medals.length === 0 ? (
        <p className="text-ink-2 dark:text-dq-300">ยังไม่มีคาบที่มีงานคิดคะแนน ทำงานในคาบให้ครูตรวจแล้วจะได้เหรียญ</p>
      ) : (
        <ul className="divide-y divide-line dark:divide-dq-800">
          {medals.map((m) => {
            const info = m.tier ? TIER_INFO[m.tier] : null
            const title = sessionTitle?.(m.session_no)
            return (
              <li key={m.session_no} className="flex items-center gap-3 py-2.5">
                <span className={`grid size-11 shrink-0 place-items-center rounded-full text-2xl ring-1 ${info ? info.tone : 'bg-surface text-slate-400 ring-line dark:bg-dq-800 dark:ring-dq-700'}`} aria-hidden>
                  {info ? info.icon : '·'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink dark:text-white">
                    คาบ {m.session_no}
                    {title && <span className="font-normal text-ink-2 dark:text-dq-300"> · {title}</span>}
                  </span>
                  <span className="text-sm text-ink-2 dark:text-dq-300">
                    {info ? `เหรียญ${info.name}` : `อีก ${fmt(50 - m.pct)}% ได้เหรียญทองแดง`}
                  </span>
                </span>
                <span className="shrink-0 font-display tabular-nums text-ink dark:text-white">{fmt(m.pct)}%</span>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-sm text-ink-2 dark:text-dq-300">
        เหรียญคิดจากคะแนนของเราเองในแต่ละคาบ งานที่ครูยังไม่ตรวจหรือยังไม่ได้ทำนับเป็น 0 ครูตรวจแล้วเหรียญจะขึ้นเอง
      </p>
    </div>
  )
}
