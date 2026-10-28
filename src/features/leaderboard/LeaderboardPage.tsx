import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Avatar } from '@/components/characters/Characters'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { levelFromXp } from '@/lib/levels'
import { useAsync } from '@/lib/useAsync'
import { fetchLeaderboard, onLeaderboardChange } from '@/features/games/gamesApi'

const MEDAL = ['🥇', '🥈', '🥉']

export function LeaderboardPage() {
  const [scope, setScope] = useState<'class' | 'all'>('class')
  const state = useAsync(() => fetchLeaderboard(scope), [scope])
  const reloadRef = useRef(state.reload)
  reloadRef.current = state.reload
  const [live, setLive] = useState(false)

  // Realtime: XP ใครเปลี่ยน → โหลดอันดับใหม่ (หน่วง 1.5 วินาทีกันโหลดถี่)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const stop = onLeaderboardChange(() => {
      setLive(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => reloadRef.current(), 1500)
    })
    return () => {
      if (timer) clearTimeout(timer)
      stop()
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-brand-900">🏆 ลีดเดอร์บอร์ด</h1>
          <p className="text-sm text-slate-500">อันดับตาม XP · {live ? '🟢 อัปเดตสด' : 'อัปเดตอัตโนมัติเมื่อมีคนได้ XP'}</p>
        </div>
        <div className="flex rounded-2xl bg-white p-1 ring-1 ring-brand-100" role="tablist">
          {(
            [
              ['class', 'ห้องฉัน'],
              ['all', 'ทุกห้อง'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={scope === k}
              onClick={() => setScope(k)}
              className={`rounded-xl px-4 py-1.5 font-display ${scope === k ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.status === 'loading' && <LoadingBlock />}
      {state.status === 'error' && <ErrorBlock message={state.error} onRetry={state.reload} />}
      {state.status === 'success' &&
        (state.data.length === 0 ? (
          <EmptyBlock>ครูปิดการแสดงลีดเดอร์บอร์ดไว้ หรือยังไม่มีใครได้ XP</EmptyBlock>
        ) : (
          <ol className="flex flex-col gap-2">
            {state.data.map((r, i) => {
              const lv = levelFromXp(r.xp)
              const gap = i > 0 && r.rank - (state.data[i - 1]?.rank ?? r.rank) > 1
              return (
                <motion.li key={`${r.rank}-${r.nickname}-${i}`} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                  {gap && <p className="py-1 text-center text-slate-400">⋯</p>}
                  <div
                    className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ring-1 ${
                      r.is_me ? 'bg-sun-300/40 ring-sun-400' : r.rank <= 3 ? 'bg-white ring-brand-200' : 'bg-white ring-brand-100'
                    }`}
                  >
                    <span className="w-10 text-center font-display text-xl text-brand-700">{MEDAL[r.rank - 1] ?? r.rank}</span>
                    <Avatar name={r.avatar} className="size-10 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-slate-800">
                        {r.nickname} {r.is_me && <span className="text-sm text-amber-800">(ฉัน)</span>}
                      </span>
                      <span className="text-xs text-slate-500">
                        {scope === 'all' && r.classroom_name ? `${r.classroom_name} · ` : ''}Lv.{lv.level} {lv.name}
                      </span>
                    </span>
                    <span className="font-display text-lg text-brand-700">{r.xp} XP</span>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        ))}
    </div>
  )
}
