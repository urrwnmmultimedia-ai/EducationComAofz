import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Award, ChartColumn, Lock, MessageSquare, Palette, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { AVATARS, Avatar, type AvatarKey } from '@/components/characters/Characters'
import { NongDataSays } from '@/components/illustrations/NongData'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { countMedals, MedalShelf } from '@/components/medals/Medals'
import { setMyAvatar } from '@/features/games/gamesApi'
import { computeGrade, formatGrade } from '@/lib/grade'
import { useAsync } from '@/lib/useAsync'
import { CATEGORIES, CATEGORY_LABEL, type Scores } from '../admin/dbqAdminApi'
import { fetchGameTitles, gameTitle } from '../gameTitles'
import { EvolutionCard } from '../EvolutionCard'
import { fetchMap } from '../lesson/dbqLessonApi'
import { fetchLeaderboard, fetchMyScores, type MyScores } from './dbqStudentApi'

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
            {a.feedback && <p className="rounded-2xl bg-dq-50 px-4 py-2 dark:bg-dq-950"><MessageSquare className="mr-1.5 inline size-5 align-[-0.2em]" aria-hidden />ครู: {a.feedback}</p>}
            {a.open ? (
              a.status !== 'graded' && (
                <Link to={`/db/lesson/${a.session_no}`} className="inline-block text-dq-700 underline-offset-2 hover:underline dark:text-dq-300">
                  {a.status === 'missing' ? 'ไปทำใบงาน →' : 'แก้ไขแล้วส่งใหม่ →'}
                </Link>
              )
            ) : (
              <p className="flex items-center gap-1.5 text-base text-slate-500"><Lock className="inline size-4 shrink-0 align-[-0.2em]" aria-hidden /> คาบนี้ยังไม่เปิด</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

type MyScoresData = Extract<MyScores, { preview: false }>

// คะแนนแบบหน้า "ฉัน" ของ ม.3: คะแนนรวม + เกรดคาดการณ์ แล้วแยกตามประเภท
function ScoreSummary({ data }: { data: MyScoresData }) {
  const s = data.scores
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-brand-50 p-5 shadow-raise ring-1 ring-brand-100 dark:from-dq-900 dark:to-dq-950 dark:shadow-none dark:ring-dq-800">
          <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-action to-gold-400" aria-hidden />
          <p className="text-base text-slate-500 dark:text-dq-300">คะแนนรวมตอนนี้ (จาก 100)</p>
          <p className="font-display text-5xl text-brand-700 dark:text-dq-100">{s.total}</p>
          <ProgressBar value={s.total} className="mt-2" />
          <p className="mt-2 text-slate-600 dark:text-dq-300">เกรดถ้าจบเทอมตอนนี้: {formatGrade(computeGrade(s.total))}</p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-mint-400/20 to-sky2-400/20 p-5 shadow-raise ring-1 ring-mint-400/50 dark:shadow-none">
          <p className="text-base text-slate-600 dark:text-dq-300">เกรดคาดการณ์ (ถ้าทำได้แบบนี้ต่อไป)</p>
          <p className="font-display text-4xl text-emerald-800 dark:text-emerald-300">
            {s.current_pct == null ? '–' : formatGrade(computeGrade(s.current_pct))}
          </p>
          <p className="text-slate-600 dark:text-dq-300">
            {s.current_pct == null
              ? 'ยังไม่มีงานที่ครูตรวจ'
              : `ตอนนี้มีคะแนนแล้ว ${s.available} จาก 100 ทำได้ ${s.current_pct}% ของส่วนนี้`}
          </p>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-xl text-dq-900 dark:text-white">แยกตามประเภท</h2>
        <ul className="flex flex-col gap-3">
          {CATEGORIES.map((c) => {
            const x = s.categories[c]
            return (
              <li key={c}>
                <div className="flex justify-between gap-2 text-base">
                  <span>{CATEGORY_LABEL[c]}</span>
                  <span className="font-display">{x?.points == null ? 'ยังไม่มีคะแนน' : `${x.points} / ${x.weight}`}</span>
                </div>
                <ProgressBar value={x?.pct ?? 0} className="mt-1" />
              </li>
            )
          })}
        </ul>
      </section>

      {data.assignments.length > 0 && (
        <section className={card}>
          <h2 className="mb-2 text-xl text-dq-900 dark:text-white">ใบงาน</h2>
          <ul className="divide-y divide-dq-100 dark:divide-dq-800">
            {data.assignments.map((a) => (
              <li key={a.item_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  {a.open ? (
                    <Link to={`/db/lesson/${a.session_no}`} className="hover:text-dq-700 hover:underline dark:hover:text-dq-200">
                      {a.title}
                    </Link>
                  ) : (
                    a.title
                  )}
                  {a.session_no && <span className="ml-2 text-sm text-slate-400">คาบ {a.session_no}</span>}
                </span>
                <span className="flex items-center gap-2 text-base">
                  {a.status === 'submitted' && <span className="rounded-full bg-sky-100 px-2 text-sky-800 dark:bg-sky-950 dark:text-sky-200">รอตรวจ</span>}
                  <span className="font-display">
                    {a.score ?? '–'} / {a.max_score}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

type MeTab = 'scores' | 'badges' | 'avatar'
const TABS: { key: MeTab; label: string; icon: LucideIcon }[] = [
  { key: 'scores', label: 'คะแนน', icon: ChartColumn },
  { key: 'badges', label: 'เหรียญ', icon: Award },
  { key: 'avatar', label: 'อวาตาร์', icon: Palette },
]

// ครูดูตัวอย่าง: หน้าตาเหมือนนักเรียนที่ยังไม่มีคะแนน (เซิร์ฟเวอร์ไม่ส่งคะแนนของใครให้ครูในหน้านี้)
const EMPTY_SCORES: MyScoresData = {
  preview: false,
  scores: {
    categories: Object.fromEntries(
      CATEGORIES.map((c) => [c, { weight: 0, earned: null, max: null, pct: null, points: null }]),
    ) as Scores['categories'],
    total: 0,
    available: 0,
    current_pct: null,
  },
  medals: [],
  assignments: [],
  games: [],
}

// ฉัน: แบบเดียวกับหน้า "ฉัน" ของ ม.3 — แท็บ คะแนน / เหรียญ / อวาตาร์ (ครูเห็นหน้าเดียวกับนักเรียน แต่ไม่บันทึกอะไร)
export function DbqMePage() {
  const { identity, refresh } = useAuth()
  const isPreview = identity.role === 'admin'
  const [params, setParams] = useSearchParams()
  const tab: MeTab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as MeTab) : 'scores'
  const res = useAsync(() => Promise.all([fetchMyScores(), fetchLeaderboard(), fetchGameTitles(), fetchMap()]), [])
  const [saving, setSaving] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  if (res.status === 'loading') return <LoadingBlock />
  if (res.status === 'error') return <ErrorBlock message={res.error} onRetry={res.reload} />
  const [rawScores, board, titles, map] = res.data
  const scores = rawScores.preview ? EMPTY_SCORES : rawScores
  const lessons = map.filter((m) => m.kind === 'lesson')
  const pending = scores.assignments.filter((a) => a.open && a.status === 'missing')
  const sessionTitle = (no: number) => map.find((m) => m.session_no === no)?.title
  const avatar = identity.student?.avatar ?? 'doctor'

  const choose = async (key: AvatarKey) => {
    if (isPreview || saving || key === avatar) return
    setSaving(key)
    setAvatarError(null)
    try {
      await setMyAvatar(key)
      await refresh()
    } catch {
      setAvatarError('เปลี่ยนอวาตาร์ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="ข้อมูลของฉัน"
        className="flex gap-1 rounded-full bg-surface/80 p-1 shadow-[inset_0_2px_5px_rgb(20_45_100/0.1)] ring-1 ring-line dark:bg-dq-950 dark:ring-dq-800"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParams(key === 'scores' ? {} : { tab: key }, { replace: true })}
            className={`tq-press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-base font-semibold ${
              tab === key
                ? 'bg-white text-action-strong shadow-[inset_0_1px_0_#fff,0_6px_14px_-6px_rgb(20_45_100/0.45)] ring-1 ring-line dark:bg-dq-800 dark:text-white dark:shadow-none dark:ring-dq-700'
                : 'text-ink-2 hover:bg-white/60 dark:text-dq-300 dark:hover:bg-dq-900'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {isPreview && (
        <p className="rounded-2xl bg-xp-300/40 px-4 py-2 text-base">โหมดครู: หน้านี้เหมือนที่นักเรียนเห็น ตัวเลขเป็นศูนย์เพราะครูไม่มีคะแนน</p>
      )}

      {tab === 'scores' && (
        <>
          <EvolutionCard
            score={scores.scores.total}
            info={{
              medals: countMedals(scores.medals),
              pending: pending.length,
              progressPct: lessons.length ? Math.round(lessons.reduce((s, m) => s + (m.pct ?? 0), 0) / lessons.length) : 0,
              nextDue: pending[0]
                ? { title: pending[0].title, to: '/db/assignments', when: pending[0].session_no ? `คาบ ${pending[0].session_no}` : 'ส่งได้เลย' }
                : null,
            }}
          />
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
                    <span>{g.plays === 0 ? 'ยังไม่เคยเล่น' : `ดีสุด ${g.best_score} · ${g.best_stars ?? 0} ดาว`}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {board.enabled && board.rows.length > 0 && (
            <section className={card}>
              <h2 className="mb-3 text-xl text-dq-900 dark:text-white">อันดับเหรียญในห้อง</h2>
              <ol className="space-y-1">
                {board.rows.map((r, i) => (
                  <li key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.is_me ? 'bg-xp-300/40 font-display' : ''}`}>
                    <span className="w-8 text-right font-display">{r.rank}</span>
                    <Avatar name={r.avatar} className="size-8 shrink-0" />
                    <span className="min-w-0 flex-1">
                      {r.nickname}
                      {r.is_me && ' (ฉัน)'}
                    </span>
                    <span className="whitespace-nowrap tabular-nums" aria-label={`ทอง ${r.gold} เงิน ${r.silver} ทองแดง ${r.bronze}`}>
                      🥇{r.gold} 🥈{r.silver} 🥉{r.bronze}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {tab === 'badges' && (
        <section className={card}>
          <h2 className="mb-3 text-xl text-dq-900 dark:text-white">เหรียญรายคาบ</h2>
          <MedalShelf medals={scores.medals} sessionTitle={sessionTitle} />
        </section>
      )}

      {tab === 'avatar' && (
        <section className={card}>
          <h2 className="mb-3 text-xl text-dq-900 dark:text-white">เลือกอวาตาร์</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {(Object.keys(AVATARS) as AvatarKey[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={avatar === k}
                disabled={saving !== null || isPreview}
                onClick={() => void choose(k)}
                data-state={avatar === k ? 'picked' : 'idle'}
                className="tq-choice flex flex-col items-center gap-1 p-2"
              >
                <Avatar name={k} className="size-16" />
                <span className="text-sm text-slate-600 dark:text-dq-300">{saving === k ? 'กำลังบันทึก…' : AVATARS[k].label}</span>
              </button>
            ))}
          </div>
          {isPreview && <p className="mt-2 text-base text-amber-800 dark:text-amber-200">โหมดครู: นักเรียนเลือกอวาตาร์ได้ตรงนี้</p>}
          {avatarError && <p className="mt-2 text-base text-rose-600 dark:text-rose-300">{avatarError}</p>}
        </section>
      )}
    </div>
  )
}
