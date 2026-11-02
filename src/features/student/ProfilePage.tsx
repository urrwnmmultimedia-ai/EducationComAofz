import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Award, ChartColumn, Palette, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { AVATARS, Avatar, type AvatarKey } from '@/components/characters/Characters'
import { ErrorBlock, LoadingBlock } from '@/components/StatusViews'
import { countMedals, MedalShelf } from '@/components/medals/Medals'
import { useAsync } from '@/lib/useAsync'
import { setMyAvatar } from '@/features/games/gamesApi'
import { fetchSessionList } from '@/features/lessons/lessonsApi'
import { courseProgressPercent } from '@/features/lessons/sessionSteps'
import type { EvoInfo } from './EvolutionCardM3'
import { dueCountdown, fetchMyMedals, fetchStudentStats } from './studentApi'
import { ScoresPanel } from './ScoresPage'
import { useViewer } from './viewer'

type Tab = 'scores' | 'badges' | 'avatar'
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'scores', label: 'คะแนน', icon: ChartColumn },
  { key: 'badges', label: 'เหรียญ', icon: Award },
  { key: 'avatar', label: 'อวาตาร์', icon: Palette },
]

// หน้า "ฉัน": การ์ดวิวัฒนาการ + แท็บ คะแนน / เหรียญรายคาบ / อวาตาร์
export function ProfilePage() {
  const { refresh } = useAuth()
  const { student, isPreview } = useViewer()
  const studentId = student?.id ?? ''
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.key === params.get('tab')) ? (params.get('tab') as Tab) : 'scores'
  const state = useAsync(async () => {
    const [medals, stats, sessions] = await Promise.all([fetchMyMedals(), fetchStudentStats(studentId), fetchSessionList()])
    return { medals, stats, sessions }
  }, [studentId])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!student) return null
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { medals, stats, sessions } = state.data
  // ข้อมูลประกอบในการ์ดวิวัฒนาการ (แท็บคะแนน)
  const next = stats.pending[0]
  const info: EvoInfo = {
    medals: countMedals(medals),
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
        <section className="tq-card p-5">
          <h2 className="mb-3 text-lg text-brand-900">เหรียญรายคาบ</h2>
          <MedalShelf medals={medals} sessionTitle={(no) => sessions.find((x) => x.session_no === no)?.title} />
        </section>
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
