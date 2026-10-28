import { useState } from 'react'
import { useAuth } from '@/app/AuthContext'
import { AVATARS, Avatar, type AvatarKey } from '@/components/characters/Characters'
import { ErrorBlock, LoadingBlock, ProgressBar } from '@/components/StatusViews'
import { levelFromXp, LEVEL_NAMES, XP_PER_LEVEL } from '@/lib/levels'
import { useAsync } from '@/lib/useAsync'
import { fetchMyBadges, setMyAvatar } from '@/features/games/gamesApi'
import { fetchStudentStats } from './studentApi'
import { studentGreeting } from './greeting'

export function ProfilePage() {
  const { identity, refresh } = useAuth()
  const student = identity.student
  const studentId = student?.id ?? ''
  const state = useAsync(async () => {
    const [badges, stats] = await Promise.all([fetchMyBadges(studentId), fetchStudentStats(studentId)])
    return { badges, stats }
  }, [studentId])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!student) return null
  if (state.status === 'loading') return <LoadingBlock />
  if (state.status === 'error') return <ErrorBlock message={state.error} onRetry={state.reload} />
  const { badges, stats } = state.data
  const lv = levelFromXp(stats.totalXp)

  const choose = async (key: AvatarKey) => {
    if (saving || key === student.avatar) return
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
      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-lg">
        <Avatar name={student.avatar} className="size-24 rounded-full bg-white/20" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">{studentGreeting(student)}</h1>
          <p className="font-display text-sun-300">
            Lv.{lv.level} {lv.name}
          </p>
          <ProgressBar value={lv.progress * 100} className="mt-2 max-w-xs bg-white/20" />
          <p className="mt-1 text-sm text-brand-100">
            {stats.totalXp} XP · อีก {lv.xpToNext} XP ขึ้นเลเวล
          </p>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
        <h2 className="mb-3 text-lg text-brand-900">เลือกอวาตาร์</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(Object.keys(AVATARS) as AvatarKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={student.avatar === k}
              disabled={saving !== null}
              onClick={() => void choose(k)}
              className={`flex flex-col items-center gap-1 rounded-2xl p-2 ring-2 transition ${student.avatar === k ? 'bg-brand-100 ring-brand-500' : 'ring-transparent hover:bg-brand-50'}`}
            >
              <Avatar name={k} className="size-16" />
              <span className="text-xs text-slate-600">{saving === k ? 'กำลังบันทึก…' : AVATARS[k].label}</span>
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
        <h2 className="mb-3 text-lg text-brand-900">
          เหรียญ ({badges.earned.size}/{badges.all.length})
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.all.map((b) => {
            const at = badges.earned.get(b.id)
            return (
              <li key={b.id} className={`flex flex-col items-center gap-1 rounded-2xl p-3 text-center ring-1 ${at ? 'bg-sun-300/30 ring-sun-400' : 'bg-slate-50 ring-slate-200'}`}>
                <span className={`text-4xl ${at ? '' : 'opacity-30 grayscale'}`} aria-hidden>
                  {b.icon}
                </span>
                <span className={`font-display text-sm ${at ? 'text-amber-950' : 'text-slate-500'}`}>{b.name}</span>
                <span className="text-xs text-slate-500">{at ? `ได้เมื่อ ${new Date(at).toLocaleDateString('th-TH')}` : 'ยังไม่ได้'}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-5 text-sm shadow-sm ring-1 ring-brand-100">
        <h2 className="mb-2 text-lg text-brand-900">วิธีได้ XP</h2>
        <ul className="grid gap-1 text-slate-600 sm:grid-cols-2">
          <li>🎮 เล่นเกม +10–50 (รอบแรกเต็ม รอบต่อไป 20%)</li>
          <li>📝 ส่งงานตรงเวลา +30</li>
          <li>🎟️ Exit ticket เต็ม +20</li>
          <li>🗓️ เข้าเรียน +10</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          ทุก {XP_PER_LEVEL} XP ขึ้น 1 เลเวล: {LEVEL_NAMES.join(' → ')}
        </p>
      </section>
    </div>
  )
}
