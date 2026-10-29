import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Award, ChartColumn, Palette, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { AVATARS, Avatar, type AvatarKey } from '@/components/characters/Characters'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { levelFromXp, LEVEL_NAMES, XP_PER_LEVEL } from '@/lib/levels'
import { useAsync } from '@/lib/useAsync'
import { fetchMyBadges, setMyAvatar } from '@/features/games/gamesApi'
import { fetchSessionList } from '@/features/lessons/lessonsApi'
import { courseProgressPercent } from '@/features/lessons/sessionSteps'
import type { EvoInfo } from './EvolutionCardM3'
import { dueCountdown, fetchStudentStats } from './studentApi'
import { ScoresPanel } from './ScoresPage'
import { useViewer } from './viewer'

type Tab = 'scores' | 'badges' | 'avatar'
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'scores', label: 'คะแนน', icon: ChartColumn },
  { key: 'badges', label: 'เหรียญ', icon: Award },
  { key: 'avatar', label: 'อวาตาร์', icon: Palette },
]

// หน้า "ฉัน": การ์ดโปรไฟล์ (เลเวล XP เหรียญ) + แท็บ คะแนน / เหรียญ / อวาตาร์
export function ProfilePage() {
  const { refresh } = useAuth()
  const { student, isPreview } = useViewer()
  const studentId = student?.id ?? ''
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'scores'
  const state = useAsync(async () => {
    const [badges, stats, sessions] = await Promise.all([fetchMyBadges(studentId), fetchStudentStats(studentId), fetchSessionList()])
    return { badges, stats, sessions }
  }, [studentId])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!student) return null
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { badges, stats, sessions } = state.data
  const lv = levelFromXp(stats.totalXp)
  // ข้อมูลประกอบในการ์ดวิวัฒนาการ (แท็บคะแนน)
  const next = stats.pending[0]
  const info: EvoInfo = {
    level: `Lv.${lv.level} ${lv.name}`,
    xp: stats.totalXp,
    badges: `${badges.earned.size}/${badges.all.length}`,
    pending: stats.pending.length,
    progressPct: courseProgressPercent(sessions),
    nextDue: next ? { title: next.title, to: `/assignments/${next.id}`, when: dueCountdown(next.due_at) } : null,
  }

  const choose = async (key: AvatarKey) => {
    if (isPreview || saving || key === student.avatar) return
    setSaving(key)
    setError(null)
    try {
      await setMyAvatar(key)
      await refresh()
    } catch {
      setError('เปลี่ยนอวาตาร์ไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="ข้อมูลของฉัน" className="flex gap-1 rounded-full bg-surface/80 p-1 shadow-[inset_0_2px_5px_rgb(20_45_100/0.1)] ring-1 ring-line">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setParams(key === 'scores' ? {} : { tab: key }, { replace: true })}
            className={`tq-press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold ${
              tab === key ? 'bg-white text-action-strong shadow-[inset_0_1px_0_#fff,0_6px_14px_-6px_rgb(20_45_100/0.45)] ring-1 ring-line' : 'text-ink-2 hover:bg-white/60'
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === 'scores' && <ScoresPanel studentId={studentId} info={info} />}

      {tab === 'badges' && (
        <>
          <section className="tq-card p-5">
            <h2 className="mb-3 text-lg text-brand-900">
              เหรียญ ({badges.earned.size}/{badges.all.length})
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {badges.all.map((b) => {
                const at = badges.earned.get(b.id)
                return (
                  <li
                    key={b.id}
                    className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center ${
                      at
                        ? 'bg-gradient-to-b from-sun-300/40 to-sun-300/10 shadow-[0_10px_20px_-14px_rgb(180_130_0/0.7)] ring-2 ring-sun-400'
                        : 'bg-slate-50 ring-1 ring-slate-200'
                    }`}
                  >
                    <span className={`text-4xl ${at ? 'drop-shadow-md' : 'opacity-30 grayscale'}`} aria-hidden>
                      {b.icon}
                    </span>
                    <span className={`font-display text-sm ${at ? 'text-amber-950' : 'text-slate-500'}`}>{b.name}</span>
                    <span className="text-xs text-slate-500">{at ? `ได้เมื่อ ${new Date(at).toLocaleDateString('th-TH')}` : 'ยังไม่ได้'}</span>
                  </li>
                )
              })}
            </ul>
          </section>
          <section className="tq-card p-5 text-sm">
            <h2 className="mb-2 text-lg text-brand-900">วิธีได้ XP</h2>
            <ul className="grid gap-1 text-slate-600 sm:grid-cols-2">
              <li>เล่นเกมในคาบ +10–50 (รอบแรกเต็ม รอบต่อไป 20%)</li>
              <li>ส่งงานตรงเวลา +30</li>
              <li>Exit ticket เต็ม +20</li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              ทุก {XP_PER_LEVEL} XP ขึ้น 1 เลเวล: {LEVEL_NAMES.join(' → ')}
            </p>
          </section>
        </>
      )}

      {tab === 'avatar' && (
        <section className="tq-card p-5">
          <h2 className="mb-3 text-lg text-brand-900">เลือกอวาตาร์</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {(Object.keys(AVATARS) as AvatarKey[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={student.avatar === k}
                disabled={saving !== null || isPreview}
                onClick={() => void choose(k)}
                data-state={student.avatar === k ? 'picked' : 'idle'}
                className="tq-choice flex flex-col items-center gap-1 p-2"
              >
                <Avatar name={k} className="size-16" />
                <span className="text-xs text-slate-600">{saving === k ? 'กำลังบันทึก…' : AVATARS[k].label}</span>
              </button>
            ))}
          </div>
          {isPreview && <p className="mt-2 text-sm text-amber-800">โหมดครู: นักเรียนเลือกอวาตาร์ได้ตรงนี้</p>}
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </section>
      )}
    </div>
  )
}
