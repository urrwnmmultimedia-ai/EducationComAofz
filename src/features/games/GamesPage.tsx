import { Link } from 'react-router'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { useAsync } from '@/lib/useAsync'
import type { MyGameItem } from '@/lib/database.types'
import { fetchMyGames } from './gamesApi'

const GROUPS: { key: string; title: string; match: (g: MyGameItem) => boolean }[] = [
  { key: '0', title: 'ทั่วไป / รวมทุกหน่วย', match: (g) => g.unit_no == null },
  { key: '1', title: 'หน่วยที่ 1 เทคโนโลยีเปลี่ยนโลก', match: (g) => g.unit_no === 1 },
  { key: '2', title: 'หน่วยที่ 2 เทคโนโลยีแก้ปัญหา', match: (g) => g.unit_no === 2 },
  { key: '3', title: 'หน่วยที่ 3 เทคโนโลยีเพิ่มมูลค่า', match: (g) => g.unit_no === 3 },
]

export function GamesPage() {
  const state = useAsync(fetchMyGames, [])
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const games = state.data

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl text-brand-900">🎮 เกม</h1>
        <p className="text-sm text-slate-500">เล่นครั้งแรกได้ XP เต็ม · รอบต่อไป 20% · ได้ XP วันละ 3 รอบต่อเกม · เกมเปิดเมื่อครูปลดล็อกคาบ</p>
      </div>
      {games.length === 0 && <EmptyBlock>ยังไม่มีเกม</EmptyBlock>}
      {GROUPS.map((grp) => {
        const list = games.filter(grp.match)
        if (list.length === 0) return null
        return (
          <section key={grp.key}>
            <h2 className="mb-3 text-lg text-brand-900">{grp.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((g) => (
                <GameCard key={g.slug} g={g} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function GameCard({ g }: { g: MyGameItem }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-lg text-slate-800">{g.title}</p>
        {!g.is_unlocked && <span aria-label="ยังไม่เปิด">🔒</span>}
      </div>
      <p className="text-sm text-slate-600">{g.description}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2 text-xs">
        <span className="rounded-full bg-sun-300/60 px-2 py-0.5 text-amber-900">สูงสุด {g.max_xp} XP</span>
        {g.session_nos.length > 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-brand-700">คาบ {g.session_nos.join(', ')}</span>}
        {g.plays > 0 && (
          <span className="rounded-full bg-mint-400/30 px-2 py-0.5 text-emerald-900">
            ดีที่สุด {g.best_score} · วันนี้ {g.plays_today}/3
          </span>
        )}
      </div>
    </>
  )
  return g.is_unlocked ? (
    <Link to={`/games/${g.slug}`} className="flex flex-col gap-1 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-100 transition hover:-translate-y-0.5 hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="flex flex-col gap-1 rounded-3xl bg-white/60 p-4 opacity-70 ring-1 ring-brand-100">{body}</div>
  )
}
