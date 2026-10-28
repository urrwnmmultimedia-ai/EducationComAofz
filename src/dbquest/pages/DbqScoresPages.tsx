import { Link } from 'react-router'
import { NongDataSays } from '@/components/illustrations/NongData'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { computeGrade, formatGrade } from '@/lib/grade'
import { useAsync } from '@/lib/useAsync'
import { CATEGORIES, CATEGORY_LABEL } from '../admin/dbqAdminApi'
import { fetchGameTitles, gameTitle } from '../gameTitles'
import { fetchLeaderboard, fetchMe, fetchMyScores, type MyScores } from './dbqStudentApi'

const card = 'rounded-3xl bg-white p-5 ring-1 ring-dq-100 dark:bg-dq-900 dark:ring-dq-800'

const STATUS: Record<'missing' | 'submitted' | 'graded', { label: string; cls: string }> = {
  missing: { label: 'ยังไม่ส่ง', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
  submitted: { label: 'ส่งแล้ว รอตรวจ', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' },
  graded: { label: 'ตรวจแล้ว', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
}

function Preview() {
  return <NongDataSays mood="think">โหมดครู: หน้านี้แสดงคะแนนของนักเรียนแต่ละคน ดูภาพรวมได้ที่หน้าครู → สมุดคะแนน</NongDataSays>
}

// งานของฉัน: ใบงานทุกคาบ สถานะ คะแนน และคอมเมนต์ครู
export function DbqAssignmentsPage() {
  const res = useAsync(fetchMyScores, [])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  if (res.data.preview) return <Preview />
  const list = res.data.assignments
  const missing = list.filter((a) => a.open && a.status === 'missing').length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-dq-900 dark:text-white">งานของฉัน</h1>
      {missing > 0 && <NongDataSays mood="think">มีใบงานที่ยังไม่ส่ง {missing} ชิ้น ไปทำในขั้น "ใบงาน" ของคาบนั้นได้เลย</NongDataSays>}
      {list.length === 0 && <p className={card}>ยังไม่มีใบงาน</p>}
      <ul className="space-y-3">
        {list.map((a) => (
          <li key={a.item_id} className={`${card} space-y-2 ${a.open ? '' : 'opacity-60'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-base text-slate-500 dark:text-dq-300">คาบ {a.session_no}</p>
                <p className="font-display text-dq-900 dark:text-white">{a.title}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-base ${STATUS[a.status].cls}`}>
                {a.status === 'graded' ? `${a.score} / ${a.max_score}` : STATUS[a.status].label}
              </span>
            </div>
            {a.feedback && <p className="rounded-2xl bg-dq-50 px-4 py-2 dark:bg-dq-950">💬 ครู: {a.feedback}</p>}
            {a.open ? (
              a.status !== 'graded' && (
                <Link to={`/db/lesson/${a.session_no}`} className="inline-block text-dq-700 underline-offset-2 hover:underline dark:text-dq-300">
                  {a.status === 'missing' ? 'ไปทำใบงาน →' : 'แก้ไขแล้วส่งใหม่ →'}
                </Link>
              )
            ) : (
              <p className="text-base text-slate-500">🔒 คาบนี้ยังไม่เปิด</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScoreSummary({ data }: { data: Extract<MyScores, { preview: false }> }) {
  const s = data.scores
  return (
    <section className={`${card} space-y-3`}>
      <h2 className="text-xl text-dq-900 dark:text-white">คะแนนสะสม</h2>
      <p className="font-display text-4xl text-dq-700 dark:text-dq-200">
        {s.total} <span className="text-xl text-slate-500 dark:text-dq-300">/ 100</span>
      </p>
      {s.current_pct != null && (
        <p className="text-base text-slate-600 dark:text-dq-300">
          ตอนนี้มีคะแนนแล้ว {s.available} จาก 100 คะแนน ทำได้ {s.current_pct}% ของส่วนนี้ (ถ้ารักษาระดับนี้ได้ เกรดประมาณ {formatGrade(computeGrade(s.current_pct))})
        </p>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {CATEGORIES.map((c) => {
          const x = s.categories[c]
          const pct = x?.pct ?? 0
          return (
            <li key={c} className="rounded-2xl bg-dq-50 p-3 dark:bg-dq-950">
              <div className="flex justify-between gap-2 text-base">
                <span>{CATEGORY_LABEL[c]}</span>
                <span className="font-display">
                  {x?.points == null ? 'ยังไม่มีคะแนน' : `${x.points} / ${x.weight}`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-dq-100 dark:bg-dq-800" aria-hidden>
                <div className="h-full rounded-full bg-xp-500" style={{ width: `${x?.pct == null ? 0 : pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ฉัน: XP เหรียญ คะแนนสะสม เกม อันดับในห้อง
export function DbqMePage() {
  const res = useAsync(() => Promise.all([fetchMe(), fetchMyScores(), fetchLeaderboard(), fetchGameTitles()]), [])
  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  const [me, scores, board, titles] = res.data
  if (scores.preview) return <Preview />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl text-dq-900 dark:text-white">ฉัน</h1>
      <section className={`${card} flex flex-wrap items-center gap-4`}>
        <p className="font-display text-4xl text-xp-600 dark:text-xp-400">{me.xp} XP</p>
        <div className="flex flex-wrap gap-2">
          {me.badges.length === 0 ? (
            <span className="text-slate-500 dark:text-dq-300">ยังไม่มีเหรียญ เรียนให้ครบคาบหรือเล่นเกมให้ได้ 3 ดาวสิ</span>
          ) : (
            me.badges.map((b) => (
              <span key={b.key} className="rounded-full bg-xp-300/40 px-3 py-1 text-base">
                {b.icon} {b.name}
              </span>
            ))
          )}
        </div>
      </section>

      <ScoreSummary data={scores} />

      {scores.games.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 text-xl text-dq-900 dark:text-white">เกม</h2>
          <ul className="space-y-2">
            {scores.games.map((g) => (
              <li key={g.game_key} className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/db/games/${g.game_key}`} className="text-dq-700 underline-offset-2 hover:underline dark:text-dq-300">
                  คาบ {g.session_no} · {gameTitle(titles, g.game_key)}
                </Link>
                <span>{g.plays === 0 ? 'ยังไม่เคยเล่น' : `ดีสุด ${g.best_score} · ${'⭐'.repeat(g.best_stars ?? 0)}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {board.enabled && board.rows.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 text-xl text-dq-900 dark:text-white">อันดับ XP ในห้อง</h2>
          <ol className="space-y-1">
            {board.rows.map((r, i) => (
              <li
                key={i}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.is_me ? 'bg-xp-300/40 font-display' : ''}`}
              >
                <span className="w-8 text-right font-display">{r.rank}</span>
                <span className="flex-1">
                  {r.nickname}
                  {r.is_me && ' (ฉัน)'}
                </span>
                <span>{r.xp} XP</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
